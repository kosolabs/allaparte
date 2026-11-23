import type { SnapshotClient } from "#viritura/crdt/snapshotClient.ts";
import * as Y from "yjs";

/** Brings the document and the server's copy up to date with each other. */
export async function exchangeSnapshots(
  doc: Y.Doc,
  snapshots: SnapshotClient,
): Promise<void> {
  const stored = await snapshots.fetch();
  if (stored) Y.applyUpdate(doc, stored);
  if (!matches(doc, stored)) {
    await snapshots.upload(Y.encodeStateAsUpdate(doc));
  }
}

function matches(doc: Y.Doc, snapshot: Uint8Array | null): boolean {
  const other = new Y.Doc();
  if (snapshot) Y.applyUpdate(other, snapshot);
  return Y.equalSnapshots(Y.snapshot(doc), Y.snapshot(other));
}
