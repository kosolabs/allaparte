import { DurableObject } from "cloudflare:workers";

const TOPIC = /^viritura\.live\.[a-z2-9]{16}$/;
const MAX_TOPICS_PER_CONNECTION = 32;
const MAX_MESSAGE_BYTES = 64 * 1024;

interface Attachment {
  topics: string[];
}

type SignalMessage =
  | { type: "subscribe" | "unsubscribe"; topics?: unknown[] }
  | { type: "publish"; topic?: unknown; [field: string]: unknown };

function topicsOf(socket: WebSocket): string[] {
  return (socket.deserializeAttachment() as Attachment | null)?.topics ?? [];
}

function setTopics(socket: WebSocket, topics: string[]): void {
  socket.serializeAttachment({ topics } satisfies Attachment);
}

function validTopics(candidates: unknown[] | undefined): string[] {
  return (candidates ?? []).filter((topic): topic is string => typeof topic === "string" && TOPIC.test(topic));
}

/**
 * y-webrtc signaling relay: introduces peers in the same room so they can
 * connect directly. Uses the WebSocket Hibernation API, so connections are
 * kept by the runtime and cost nothing while idle.
 */
export class Signaling extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"type":"ping"}', '{"type":"pong"}'));
  }

  async fetch(): Promise<Response> {
    const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
    this.ctx.acceptWebSocket(server);
    setTopics(server, []);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket: WebSocket, data: string | ArrayBuffer): Promise<void> {
    if (typeof data !== "string" || data.length > MAX_MESSAGE_BYTES) return;
    let message: SignalMessage;
    try {
      message = JSON.parse(data) as SignalMessage;
    } catch {
      return;
    }
    if (message.type === "subscribe") this.subscribe(socket, validTopics(message.topics));
    if (message.type === "unsubscribe") this.unsubscribe(socket, validTopics(message.topics));
    if (message.type === "publish" && typeof message.topic === "string") this.publish(message, message.topic);
  }

  async webSocketClose(socket: WebSocket, code: number): Promise<void> {
    socket.close(code, "closing");
  }

  private subscribe(socket: WebSocket, topics: string[]): void {
    const merged = [...new Set([...topicsOf(socket), ...topics])].slice(0, MAX_TOPICS_PER_CONNECTION);
    setTopics(socket, merged);
  }

  private unsubscribe(socket: WebSocket, topics: string[]): void {
    setTopics(
      socket,
      topicsOf(socket).filter((topic) => !topics.includes(topic)),
    );
  }

  private publish(message: SignalMessage, topic: string): void {
    const receivers = this.ctx.getWebSockets().filter((socket) => topicsOf(socket).includes(topic));
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
