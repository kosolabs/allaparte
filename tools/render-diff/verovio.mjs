import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { basename, join } from "node:path";
import { TARGET } from "./environment.mjs";

const OUTPUT = join(TARGET, "verovio");
const OPTIONS = [
  "--all-pages",
  "--adjust-page-height",
  "--adjust-page-width",
  "--header=none",
  "--footer=none",
  "--xml-id-checksum",
];

/** Maps each MusicXML file to the pages Verovio drew of it. */
export function drawInVerovio(scores) {
  rmSync(OUTPUT, { recursive: true, force: true });
  mkdirSync(OUTPUT, { recursive: true });
  for (const score of scores) {
    const out = join(OUTPUT, `${basename(score, ".musicxml")}.svg`);
    const args = [...OPTIONS, "--outfile", out, score];
    const { error, status, stderr } = spawnSync("verovio", args);
    if (error) throw error;
    if (status !== 0) console.warn(`Verovio can't draw ${score}: ${stderr}`);
  }
  return new Map(scores.map((score) => [score, pages(score)]));
}

// One page is drawn to name.svg, several to name_001.svg, name_002.svg, ….
function pages(score) {
  const page = new RegExp(`^${basename(score, ".musicxml")}(_\\d+)?\\.svg$`);
  return readdirSync(OUTPUT)
    .filter((file) => page.test(file))
    .sort()
    .map((file) => join(OUTPUT, file));
}
