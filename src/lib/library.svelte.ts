import { createSubscriber } from "svelte/reactivity";
import type * as Y from "yjs";
import { openLibrary, openScore, writeScore } from "./documents.js";
import { readMetadata, type Metadata } from "./metadata.js";
import { generateRoomId, type Json } from "./viritura/index.js";

export interface Piece extends Metadata {
  id: string;
  title: string;
}

export class Library {
  readonly loaded: Promise<unknown>;
  readonly #pieces: Y.Map<Metadata & { title: string }>;
  readonly #subscribe: () => void;

  constructor() {
    const { doc, loaded } = openLibrary();
    this.loaded = loaded;
    this.#pieces = doc.getMap("pieces");
    this.#subscribe = createSubscriber((update) => {
      this.#pieces.observe(update);
      return () => this.#pieces.unobserve(update);
    });
  }

  get pieces(): Piece[] {
    this.#subscribe();
    return Array.from(this.#pieces, ([id, piece]) => ({ id, ...piece })).sort(
      (a, b) => a.title.localeCompare(b.title),
    );
  }

  async add(mnx: Json, fallbackTitle: string): Promise<string> {
    const id = generateRoomId();
    const { doc, loaded } = openScore(id);
    await loaded;
    writeScore(doc, mnx);
    doc.destroy();

    const { title, composer, arranger } = readMetadata(mnx);
    this.#pieces.set(id, {
      title: title ?? fallbackTitle,
      ...(composer && { composer }),
      ...(arranger && { arranger }),
    });
    return id;
  }
}

export const library = new Library();
