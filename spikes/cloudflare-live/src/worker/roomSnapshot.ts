import { DurableObject } from "cloudflare:workers";
import * as Y from "yjs";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const CHUNK_BYTES = 1024 * 1024;
const CHUNK_COUNT_KEY = "chunkCount";

const chunkKey = (index: number): string => `chunk:${index}`;

/** Removes Viritura's host claim, which would otherwise lock later editors out of a durable room. */
function withoutHostClaim(update: Uint8Array): Uint8Array {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, update);
  const meta = doc.getMap("_meta");
  if (!meta.has("hostClientId")) return update;
  meta.delete("hostClientId");
  return Y.encodeStateAsUpdate(doc);
}

/**
 * Holds one room's latest Yjs state. Requests are handled one at a time, so
 * concurrent uploads merge instead of overwriting each other.
 */
export class RoomSnapshot extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    if (request.method === "GET") return this.get();
    if (request.method === "PUT") return this.put(request);
    return new Response("Method not allowed", { status: 405 });
  }

  private async get(): Promise<Response> {
    const snapshot = await this.load();
    if (!snapshot) return new Response(null, { status: 404 });
    return new Response(snapshot, { headers: { "content-type": "application/octet-stream" } });
  }

  private async put(request: Request): Promise<Response> {
    const incoming = new Uint8Array(await request.arrayBuffer());
    if (incoming.byteLength > MAX_UPLOAD_BYTES) return new Response("Snapshot too large", { status: 413 });
    const stored = await this.load();
    let merged: Uint8Array;
    try {
      merged = withoutHostClaim(stored ? Y.mergeUpdates([stored, incoming]) : incoming);
    } catch {
      return new Response("Not a Yjs update", { status: 400 });
    }
    await this.save(merged);
    return new Response(null, { status: 204 });
  }

  private async load(): Promise<Uint8Array | null> {
    const count = await this.ctx.storage.get<number>(CHUNK_COUNT_KEY);
    if (!count) return null;
    const keys = Array.from({ length: count }, (_, index) => chunkKey(index));
    const chunks = await this.ctx.storage.get<Uint8Array>(keys);
    const bytes = new Uint8Array(keys.reduce((total, key) => total + (chunks.get(key)?.byteLength ?? 0), 0));
    let offset = 0;
    for (const key of keys) {
      const chunk = chunks.get(key);
      if (!chunk) continue;
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  }

  private async save(snapshot: Uint8Array): Promise<void> {
    const previousCount = (await this.ctx.storage.get<number>(CHUNK_COUNT_KEY)) ?? 0;
    const count = Math.ceil(snapshot.byteLength / CHUNK_BYTES);
    const entries: Record<string, Uint8Array | number> = { [CHUNK_COUNT_KEY]: count };
    for (let index = 0; index < count; index++) {
      entries[chunkKey(index)] = snapshot.slice(index * CHUNK_BYTES, (index + 1) * CHUNK_BYTES);
    }
    await this.ctx.storage.put(entries);
    const stale = Array.from({ length: Math.max(0, previousCount - count) }, (_, index) => chunkKey(count + index));
    if (stale.length > 0) await this.ctx.storage.delete(stale);
  }
}
