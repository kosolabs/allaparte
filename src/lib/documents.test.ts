import { expect, test } from "vitest";
import * as Y from "yjs";
import { readScore, writeScore } from "./documents.js";

test("a score survives the round trip through its document and a peer", () => {
  const mnx = {
    mnx: { version: 1 },
    parts: [{ id: "violin", measures: [{ sequences: [] }] }],
  };
  const doc = new Y.Doc();
  expect(readScore(doc)).toBeUndefined();

  writeScore(doc, mnx);
  const peer = new Y.Doc();
  Y.applyUpdate(peer, Y.encodeStateAsUpdate(doc));

  expect(readScore(peer)).toEqual(mnx);
});
