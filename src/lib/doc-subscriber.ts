import { createSubscriber } from "svelte/reactivity";
import type * as Y from "yjs";

const SETTLE_MS = 100;

/** Re-runs whatever reads the document after each burst of edits. */
export function docSubscriber(doc: Y.Doc): () => void {
  return createSubscriber((update) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settle = () => {
      clearTimeout(timer);
      timer = setTimeout(update, SETTLE_MS);
    };
    doc.on("update", settle);
    return () => {
      clearTimeout(timer);
      doc.off("update", settle);
    };
  });
}
