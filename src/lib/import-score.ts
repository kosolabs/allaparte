import {
  convertMusicXmlToMnx,
  convertMxlToMnx,
  DiagnosticCollector,
  type MnxDiagnostic,
} from "#viritura/musicxml";
import type { Json } from "./json.js";

export interface ImportedScore {
  mnx: Json;
  diagnostics: readonly MnxDiagnostic[];
}

export async function importScore(file: File): Promise<ImportedScore> {
  const diagnostics = new DiagnosticCollector();
  const mnx = (await convert(file, diagnostics)) as Json;
  return { mnx, diagnostics: diagnostics.all() };
}

async function convert(
  file: File,
  diagnostics: DiagnosticCollector,
): Promise<object> {
  const options = { includeVendorExtensions: true, diagnostics };
  switch (file.name.toLowerCase().split(".").at(-1)) {
    case "mxl":
      return convertMxlToMnx(await file.arrayBuffer(), options);
    case "musicxml":
    case "xml":
      return convertMusicXmlToMnx(await file.text(), options);
    case "mnx":
    case "json":
      return JSON.parse(await file.text());
    default:
      throw new Error("Choose a .mxl, .musicxml or .mnx file.");
  }
}
