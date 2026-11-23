import { expect, test } from "vitest";
import * as Y from "yjs";
import { mergeSnapshots } from "./merge-snapshots";

function snapshot(edit: (doc: Y.Doc) => void, base?: Uint8Array) {
  const doc = new Y.Doc();
  if (base) Y.applyUpdate(doc, base);
  edit(doc);
  return Y.encodeStateAsUpdate(doc);
}

function read(update: Uint8Array) {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, update);
  return {
    score: doc.getMap("score").toJSON(),
    meta: doc.getMap("_meta").toJSON(),
  };
}

test("keeps both sides of concurrent uploads", () => {
  const base = snapshot((doc) => doc.getMap("score").set("title", "Milonga"));
  const left = snapshot((doc) => doc.getMap("score").set("left", 1), base);
  const right = snapshot((doc) => doc.getMap("score").set("right", 2), base);

  expect(read(mergeSnapshots(left, right)).score).toEqual({
    title: "Milonga",
    left: 1,
    right: 2,
  });
});

test("drops an editor's host claim, even when the claim is uploaded again", () => {
  const claimed = snapshot((doc) => doc.getMap("_meta").set("hostClientId", 7));

  const stored = mergeSnapshots(null, claimed);
  expect(read(stored).meta).toEqual({});
  expect(read(mergeSnapshots(stored, claimed)).meta).toEqual({});
});

test("rejects bytes that aren't a Yjs update", () => {
  expect(() => mergeSnapshots(null, new Uint8Array([255, 255]))).toThrow();
});
