import * as Y from "yjs";

/**
 * Viritura's editor claims a room as its host, and ends the session for
 * everyone else when that host leaves. Our rooms outlive any one editor.
 */
export function mergeSnapshots(
  stored: Uint8Array | null,
  incoming: Uint8Array,
): Uint8Array {
  const doc = new Y.Doc();
  if (stored) Y.applyUpdate(doc, stored);
  Y.applyUpdate(doc, incoming);
  doc.getMap("_meta").delete("hostClientId");
  return Y.encodeStateAsUpdate(doc);
}
