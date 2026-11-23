import type { Json } from "./viritura/index.js";

const LAYOUT_EXTENSIONS = ["pageSetup", "layoutBreaks", "textFrames"];

/** The score without the arranger's page layout and engraving choices. */
export function toReaderPresentation(mnx: Json): Json {
  const reader = structuredClone(mnx);
  objects(reader.scores).forEach(stripPageLayout);
  for (const part of objects(reader.parts)) {
    objects(part.measures).forEach(stripMeasure);
  }
  return reader;
}

function stripPageLayout(score: Json) {
  delete score.pages;
  const viritura = (score._x as { viritura?: Json } | undefined)?.viritura;
  if (!viritura) return;
  for (const key of LAYOUT_EXTENSIONS) delete viritura[key];
}

function stripMeasure(measure: Json) {
  delete measure.beams;
  for (const sequence of objects(measure.sequences)) {
    delete sequence.stem;
    objects(sequence.content).forEach(stripContent);
  }
}

function stripContent(content: Json) {
  delete content.stemDirection;
  for (const slur of objects(content.slurs)) {
    delete slur.side;
    delete slur.sideEnd;
  }
  for (const note of objects(content.notes)) {
    for (const tie of objects(note.ties)) delete tie.side;
  }
  objects(content.content).forEach(stripContent);
}

function objects(value: unknown): Json[] {
  return Array.isArray(value) ? value : [];
}
