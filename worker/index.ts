import { getEnsemble, registerPiece } from "./ensembles";
import { isRegistered } from "./rooms";

export { RoomSnapshot } from "./room-snapshot";
export { Signaling } from "./signaling";

const ID = "([a-z2-9]{16})";
const ENSEMBLE = new RegExp(`^/api/ensembles/${ID}$`);
const PIECE = new RegExp(`^/api/ensembles/${ID}/pieces/${ID}$`);
const SNAPSHOT = new RegExp(`^/live/room/${ID}/snapshot$`);
const LOCATION_HINT = "wnam";

export default {
  async fetch(request, env): Promise<Response> {
    const { pathname } = new URL(request.url);
    const origin = allowedOrigin(request, env);

    if (pathname === "/live/signal") return signal(request, env, origin);

    const response =
      request.method === "OPTIONS"
        ? new Response(null, { status: 204 })
        : await route(request, env, pathname);
    return origin ? withCors(response, origin) : response;
  },
} satisfies ExportedHandler<Env>;

function signal(
  request: Request,
  env: Env,
  origin: string | undefined,
): Response | Promise<Response> {
  if (request.headers.get("Upgrade") !== "websocket") {
    return new Response("Expected a WebSocket upgrade", { status: 426 });
  }
  if (!origin) return new Response("Forbidden", { status: 403 });
  const id = env.SIGNALING.idFromName("global");
  return env.SIGNALING.get(id, { locationHint: LOCATION_HINT }).fetch(request);
}

async function route(
  request: Request,
  env: Env,
  pathname: string,
): Promise<Response> {
  const snapshot = SNAPSHOT.exec(pathname);
  if (snapshot && (await isRegistered(env.DB, snapshot[1]))) {
    const id = env.SNAPSHOTS.idFromName(snapshot[1]);
    const stub = env.SNAPSHOTS.get(id, { locationHint: LOCATION_HINT });
    return stub.fetch(request);
  }

  const ensemble = ENSEMBLE.exec(pathname);
  if (ensemble && request.method === "GET") {
    return getEnsemble(env.DB, ensemble[1]);
  }

  const piece = PIECE.exec(pathname);
  if (piece && request.method === "PUT") {
    return registerPiece(env.DB, piece[1], piece[2]);
  }

  if (pathname === "/auth/me") {
    return Response.json({ authenticated: false, user: null });
  }

  return new Response("Not found", { status: 404 });
}

function allowedOrigin(request: Request, env: Env): string | undefined {
  const origin = request.headers.get("Origin");
  if (!origin) return undefined;
  const allowed = env.ALLOWED_ORIGINS.split(" ");
  return allowed.includes(origin) ? origin : undefined;
}

function withCors(response: Response, origin: string): Response {
  const result = new Response(response.body, response);
  result.headers.set("Access-Control-Allow-Origin", origin);
  result.headers.set("Access-Control-Allow-Credentials", "true");
  result.headers.set("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
  result.headers.set("Access-Control-Allow-Headers", "content-type");
  result.headers.set("Vary", "Origin");
  return result;
}
