import { parseArgs } from "node:util";
import { byName, readManifest, recordTests } from "./engine.mjs";
import { drawInMuseScore } from "./musescore.mjs";
import { writeReport } from "./report.mjs";

const { positionals: tests, values: options } = parseArgs({
  allowPositionals: true,
  options: { musescore: { type: "boolean" } },
});
if (tests.length === 0) {
  throw new Error("Usage: pnpm render:test <test>... [--musescore]");
}

const renderings = readManifest(recordTests(tests)).sort(byName);
for (const rendering of renderings) {
  rendering.images = rendering.pages.map((svg, i, { length }) => ({
    label: length > 1 ? `Viritura (page ${i + 1})` : "Viritura",
    svg,
  }));
}
if (options.musescore) drawInMuseScore(renderings);
console.log(`${renderings.length} renderings`);
console.log(writeReport(tests.join(", "), renderings));
