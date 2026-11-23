import type * as Y from "yjs";

export type Json = Record<string, unknown>;

export interface Diagnostic {
  severity: "error" | "warning" | "info";
  message: string;
}

export interface ConvertOptions {
  includeVendorExtensions?: boolean;
  diagnostics?: DiagnosticCollector;
}

export class DiagnosticCollector {
  all(): readonly Diagnostic[];
}

export function convertMusicXmlToMnx(
  xml: string,
  options?: ConvertOptions,
): Json;

export function convertMxlToMnx(
  mxl: ArrayBuffer | Uint8Array,
  options?: ConvertOptions,
): Promise<Json>;

export function syncJsonToYDoc(json: Json, doc: Y.Doc, rootKey: string): void;
export function readJsonFromYDoc(doc: Y.Doc, rootKey: string): Json;
export function generateRoomId(): string;
