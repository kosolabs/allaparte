import { syncJsonToYDoc } from "#viritura/crdt/yProjection/syncJsonToYDoc.ts";
import { readJsonFromYDoc } from "#viritura/crdt/yProjection/yDocToJson.ts";
import type * as Y from "yjs";
import type { Json } from "./json.js";

// Viritura's editor reads the score from this key.
const SCORE_ROOT = "score";

export function readScore(doc: Y.Doc): Json | undefined {
  return doc.getMap(SCORE_ROOT).size > 0
    ? readJsonFromYDoc(doc, SCORE_ROOT)
    : undefined;
}

export function writeScore(doc: Y.Doc, mnx: Json) {
  syncJsonToYDoc(mnx, doc, SCORE_ROOT);
}
