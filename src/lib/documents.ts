import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";
import {
  readJsonFromYDoc,
  syncJsonToYDoc,
  type Json,
} from "./viritura/index.js";

// Viritura's editor reads the score from this key.
const SCORE_ROOT = "score";

export interface StoredDocument {
  doc: Y.Doc;
  loaded: Promise<unknown>;
}

export function openLibrary(): StoredDocument {
  return open("library");
}

export function openScore(id: string): StoredDocument {
  return open(`score/${id}`);
}

function open(name: string): StoredDocument {
  const doc = new Y.Doc();
  return { doc, loaded: new IndexeddbPersistence(name, doc).whenSynced };
}

export function readScore(doc: Y.Doc): Json | undefined {
  return doc.getMap(SCORE_ROOT).size > 0
    ? readJsonFromYDoc(doc, SCORE_ROOT)
    : undefined;
}

export function writeScore(doc: Y.Doc, mnx: Json) {
  syncJsonToYDoc(mnx, doc, SCORE_ROOT);
}
