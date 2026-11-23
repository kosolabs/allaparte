import type { Json } from "./viritura/index.js";

export interface Metadata {
  title?: string;
  composer?: string;
  arranger?: string;
}

export function readMetadata(mnx: Json): Metadata {
  const extensions = mnx._x as { viritura?: { metadata?: Metadata } };
  return extensions?.viritura?.metadata ?? {};
}
