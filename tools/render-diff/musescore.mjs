import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { TARGET } from "./environment.mjs";

const OUTPUT = join(TARGET, "musescore");
const TRIM_MARGIN = 10;
// MuseScore waits on a hidden dialog when it can't read a file.
const TIMEOUT = 30_000;
const TIMEOUT_PER_SCORE = 500;

/** Maps each MusicXML file to the pages MuseScore drew of it. */
export function drawInMuseScore(scores) {
  rmSync(OUTPUT, { recursive: true, force: true });
  mkdirSync(OUTPUT, { recursive: true });
  const job = join(OUTPUT, "job.json");
  const draw = (score) => ({
    in: score,
    out: join(OUTPUT, `${basename(score, ".musicxml")}.svg`),
  });
  writeFileSync(job, JSON.stringify(scores.map(draw)));
  const { error } = spawnSync("mscore", ["-T", TRIM_MARGIN, "-j", job], {
    timeout: TIMEOUT + TIMEOUT_PER_SCORE * scores.length,
    killSignal: "SIGKILL",
  });
  if (error) console.warn(`MuseScore stopped early: ${error.message}`);
  return new Map(scores.map((score) => [score, pages(score)]));
}

function pages(score) {
  const page = new RegExp(`^${basename(score, ".musicxml")}-(\\d+)\\.svg$`);
  return readdirSync(OUTPUT)
    .filter((file) => page.test(file))
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }))
    .map((file) => join(OUTPUT, file));
}
