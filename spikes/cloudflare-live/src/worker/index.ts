export { Signaling } from "./signaling";
export { RoomSnapshot } from "./roomSnapshot";

const SNAPSHOT_PATH = /^\/live\/room\/([a-z2-9]{16})\/snapshot$/;
const LOCATION_HINT = "wnam";

function isSameOrigin(request: Request, url: URL): boolean {
  const origin = request.headers.get("Origin");
  return origin !== null && new URL(origin).host === url.host;
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/live/signal") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected a WebSocket upgrade", { status: 426 });
      }
      if (!isSameOrigin(request, url)) return new Response("Forbidden", { status: 403 });
      const id = env.SIGNALING.idFromName("global");
      return env.SIGNALING.get(id, { locationHint: LOCATION_HINT }).fetch(request);
    }

    const room = SNAPSHOT_PATH.exec(url.pathname);
    if (room?.[1]) {
      const id = env.SNAPSHOTS.idFromName(room[1]);
      return env.SNAPSHOTS.get(id, { locationHint: LOCATION_HINT }).fetch(request);
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
