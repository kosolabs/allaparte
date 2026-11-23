import { DurableObject } from "cloudflare:workers";
import { isRegistered } from "./rooms";

const TOPIC = /^viritura\.live\.([a-z2-9]{16})$/;
const MAX_TOPICS_PER_CONNECTION = 32;
const MAX_MESSAGE_BYTES = 64 * 1024;

interface Attachment {
  topics: string[];
}

type SignalMessage =
  | { type: "subscribe" | "unsubscribe"; topics?: unknown }
  | { type: "publish"; topic?: unknown; [field: string]: unknown };

/**
 * y-webrtc signaling relay: introduces peers in the same room so they can
 * connect directly. Uses the WebSocket Hibernation API, so connections are
 * kept by the runtime and cost nothing while idle.
 */
export class Signaling extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('{"type":"ping"}', '{"type":"pong"}'),
    );
  }

  async fetch(): Promise<Response> {
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    setTopics(server, []);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(
    socket: WebSocket,
    data: string | ArrayBuffer,
  ): Promise<void> {
    if (typeof data !== "string" || data.length > MAX_MESSAGE_BYTES) return;
    const message = parse(data);
    switch (message?.type) {
      case "subscribe":
        // A peer announces itself right after subscribing.
        return this.ctx.blockConcurrencyWhile(() =>
          this.#subscribe(socket, strings(message.topics)),
        );
      case "unsubscribe":
        return this.#unsubscribe(socket, strings(message.topics));
      case "publish":
        return this.#publish(socket, message);
    }
  }

  async webSocketClose(socket: WebSocket): Promise<void> {
    socket.close();
  }

  async #subscribe(socket: WebSocket, topics: string[]): Promise<void> {
    const allowed: string[] = [];
    for (const topic of topics.slice(0, MAX_TOPICS_PER_CONNECTION)) {
      const roomId = TOPIC.exec(topic)?.[1];
      if (roomId && (await isRegistered(this.env.DB, roomId))) {
        allowed.push(topic);
      }
    }
    const merged = [...new Set([...topicsOf(socket), ...allowed])];
    setTopics(socket, merged.slice(0, MAX_TOPICS_PER_CONNECTION));
  }

  #unsubscribe(socket: WebSocket, topics: string[]) {
    setTopics(
      socket,
      topicsOf(socket).filter((topic) => !topics.includes(topic)),
    );
  }

  #publish(socket: WebSocket, message: SignalMessage & { type: "publish" }) {
    const { topic } = message;
    if (typeof topic !== "string" || !topicsOf(socket).includes(topic)) return;
    const receivers = this.ctx
      .getWebSockets()
      .filter((receiver) => topicsOf(receiver).includes(topic));
    const payload = JSON.stringify({ ...message, clients: receivers.length });
    for (const receiver of receivers) {
      try {
        receiver.send(payload);
      } catch {
        receiver.close(1011, "send failed");
      }
    }
  }
}

function topicsOf(socket: WebSocket): string[] {
  return (socket.deserializeAttachment() as Attachment | null)?.topics ?? [];
}

function setTopics(socket: WebSocket, topics: string[]) {
  socket.serializeAttachment({ topics } satisfies Attachment);
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string")
    : [];
}

function parse(data: string): SignalMessage | undefined {
  try {
    return JSON.parse(data) as SignalMessage;
  } catch {
    return undefined;
  }
}
