import { generateRoomId } from "#viritura/crdt/roomId.ts";
import { docSubscriber } from "./doc-subscriber.js";
import type { Json } from "./json.js";
import { readMetadata, type Metadata } from "./metadata.js";
import { Room } from "./room.js";
import { writeScore } from "./score.js";

export interface Piece extends Metadata {
  id: string;
  title: string;
}

export class Library {
  readonly #ensembleId: string;
  readonly #room: Room;
  readonly #subscribe: () => void;

  constructor(ensembleId: string) {
    this.#ensembleId = ensembleId;
    this.#room = new Room(ensembleId);
    this.#subscribe = docSubscriber(this.#room.doc);
  }

  get ready() {
    return this.#room.ready;
  }

  get pieces(): Piece[] {
    this.#subscribe();
    return Array.from(this.#pieces, ([id, piece]) => ({ id, ...piece })).sort(
      (a, b) => a.title.localeCompare(b.title),
    );
  }

  async add(mnx: Json, fallbackTitle: string) {
    const id = generateRoomId();
    await register(this.#ensembleId, id);

    const room = new Room(id);
    await room.ready;
    writeScore(room.doc, mnx);
    await room.close();

    const { title, composer, arranger } = readMetadata(mnx);
    this.#pieces.set(id, {
      title: title ?? fallbackTitle,
      ...(composer && { composer }),
      ...(arranger && { arranger }),
    });
  }

  close() {
    return this.#room.close();
  }

  get #pieces() {
    return this.#room.doc.getMap<Metadata & { title: string }>("pieces");
  }
}

async function register(ensembleId: string, pieceId: string) {
  const response = await fetch(
    `/api/ensembles/${ensembleId}/pieces/${pieceId}`,
    {
      method: "PUT",
    },
  );
  if (!response.ok) throw new Error("The server didn't accept the piece.");
}
