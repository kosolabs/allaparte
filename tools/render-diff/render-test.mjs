import { parseArgs } from "node:util";
import { byName, readManifest, recordTests } from "./engine.mjs";
import { drawInMuseScore } from "./musescore.mjs";
import { convertToMusicXml } from "./musicxml.mjs";
import { workingTree } from "./recordings.mjs";
import { writeReport } from "./report.mjs";
import { drawInVerovio } from "./verovio.mjs";

const { positionals: tests, values: options } = parseArgs({
  allowPositionals: true,
  options: {
    musescore: { type: "boolean" },
    verovio: { type: "boolean" },
  },
});
if (tests.length === 0) {
  throw new Error(
    "Usage: pnpm render:test <test>... [--musescore] [--verovio]",
  );
}
const otherEngines = [
  options.musescore && { name: "MuseScore", draw: drawInMuseScore },
  options.verovio && { name: "Verovio", draw: drawInVerovio },
].filter(Boolean);

const renderings = readManifest(recordTests(tests)).sort(byName);
for (const rendering of renderings) {
  rendering.images = rendering.pages.map((svg, i, { length }) => ({
    label: length > 1 ? `Viritura (page ${i + 1})` : "Viritura",
    svg,
  }));
  rendering.others = [];
}
if (otherEngines.length > 0) drawInOtherEngines(renderings);
console.log(`${renderings.length} renderings`);
console.log(writeReport(reportName(), tests.join(", "), renderings));

function drawInOtherEngines(renderings) {
  const scores = convertToMusicXml([...new Set(renderings.map((r) => r.mnx))]);
  for (const { name, draw } of otherEngines) {
    const drawings = draw([...scores.values()]);
    for (const rendering of renderings) {
      const pages = drawings.get(scores.get(rendering.mnx)) ?? [];
      rendering.others.push({ name, pages });
    }
  }
}

function reportName() {
  const engines = otherEngines.map(({ name }) => `-${name.toLowerCase()}`);
  const names = tests.join("+").replace(/[^\w.+-]/g, "_");
  return `test-${names}-${workingTree().slice(0, 8)}${engines.join("")}`;
}
