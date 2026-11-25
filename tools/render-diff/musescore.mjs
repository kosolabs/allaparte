import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { TARGET, TOOL, VIRITURA } from "./environment.mjs";

const TSX = join(VIRITURA, "node_modules/.bin/tsx");
const OUTPUT = join(TARGET, "musescore");
const TRIM_MARGIN = 10;
// MuseScore waits on a hidden dialog when it can't read a file.
const TIMEOUT = 30_000;
const TIMEOUT_PER_SCORE = 500;

export function drawInMuseScore(renderings) {
  if (spawnSync("mscore", ["--version"]).error) {
    console.warn("MuseScore isn't installed, so its pictures are left out");
    return;
  }
  rmSync(OUTPUT, { recursive: true, force: true });
  mkdirSync(OUTPUT, { recursive: true });
  const files = [...new Set(renderings.map(({ mnx }) => mnx))];
  convertToMusicXml(files);
  drawMusicXml();
  const drawings = new Map(files.map((file) => [file, pages(file)]));
  for (const rendering of renderings) {
    rendering.museScore = drawings.get(rendering.mnx);
  }
}

function convertToMusicXml(files) {
  spawnSync(TSX, [join(TOOL, "to-musicxml.ts"), OUTPUT, ...files], {
    stdio: "inherit",
  });
}

function drawMusicXml() {
  const scores = readdirSync(OUTPUT).filter((file) => /\.musicxml$/.test(file));
  const job = join(OUTPUT, "job.json");
  const draw = (score) => ({
    in: join(OUTPUT, score),
    out: join(OUTPUT, score.replace(/\.musicxml$/, ".svg")),
  });
  writeFileSync(job, JSON.stringify(scores.map(draw)));
  const { error } = spawnSync("mscore", ["-T", TRIM_MARGIN, "-j", job], {
    timeout: TIMEOUT + TIMEOUT_PER_SCORE * scores.length,
    killSignal: "SIGKILL",
  });
  if (error) console.warn(`MuseScore stopped early: ${error.message}`);
}

function pages(mnx) {
  const page = new RegExp(`^${basename(mnx, ".mnx")}-(\\d+)\\.svg$`);
  return readdirSync(OUTPUT)
    .filter((file) => page.test(file))
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }))
    .map((file) => join(OUTPUT, file));
}
