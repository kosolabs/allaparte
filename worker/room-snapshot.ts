import { DurableObject } from "cloudflare:workers";
import { mergeSnapshots } from "./merge-snapshots";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const CHUNK_BYTES = 1024 * 1024;
const CHUNK_COUNT_KEY = "chunkCount";

/**
 * Holds one room's latest Yjs state. Requests are handled one at a time, so
 * concurrent uploads merge instead of overwriting each other.
 */
export class RoomSnapshot extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    switch (request.method) {
      case "GET":
        return this.#get();
      case "PUT":
        return this.ctx.blockConcurrencyWhile(() => this.#put(request));
      default:
        return new Response("Method not allowed", { status: 405 });
    }
  }

  async #get(): Promise<Response> {
    const snapshot = await this.#load();
    return snapshot
      ? new Response(snapshot, {
          headers: { "content-type": "application/octet-stream" },
        })
      : new Response(null, { status: 404 });
  }

  async #put(request: Request): Promise<Response> {
    const incoming = new Uint8Array(await request.arrayBuffer());
    if (incoming.byteLength > MAX_UPLOAD_BYTES) {
      return new Response("Snapshot too large", { status: 413 });
    }
    const stored = await this.#load();
    let merged: Uint8Array;
    try {
      merged = mergeSnapshots(stored, incoming);
    } catch {
      return new Response("Not a Yjs update", { status: 400 });
    }
    await this.#save(merged);
    return new Response(null, { status: 204 });
  }

  async #load(): Promise<Uint8Array<ArrayBuffer> | null> {
    const count = await this.ctx.storage.get<number>(CHUNK_COUNT_KEY);
    if (!count) return null;
    const keys = Array.from({ length: count }, (_, index) => chunkKey(index));
    const chunks = await this.ctx.storage.get<Uint8Array<ArrayBuffer>>(keys);
    const blob = new Blob(keys.map((key) => chunks.get(key)!));
    return new Uint8Array(await blob.arrayBuffer());
  }

  async #save(snapshot: Uint8Array): Promise<void> {
    const previousCount =
      (await this.ctx.storage.get<number>(CHUNK_COUNT_KEY)) ?? 0;
    const count = Math.ceil(snapshot.byteLength / CHUNK_BYTES);
    const entries: Record<string, Uint8Array | number> = {
      [CHUNK_COUNT_KEY]: count,
    };
    for (let index = 0; index < count; index++) {
      entries[chunkKey(index)] = snapshot.slice(
        index * CHUNK_BYTES,
        (index + 1) * CHUNK_BYTES,
      );
    }
    await this.ctx.storage.put(entries);
    for (let index = count; index < previousCount; index++) {
      await this.ctx.storage.delete(chunkKey(index));
    }
  }
}

function chunkKey(index: number): string {
  return `chunk:${index}`;
}
