import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { basename, join } from "node:path";

const TOOL = import.meta.dirname;
const TSX = join(TOOL, "../../vendor/viritura/node_modules/.bin/tsx");
const OUTPUT = join(TOOL, "target/musescore");
const TRIM_MARGIN = 10;
// MuseScore waits on a hidden dialog when it can't read a file.
const TIMEOUT = 10_000;

export function drawInMuseScore(renderings) {
  if (spawnSync("mscore", ["--version"]).error) {
    console.warn("MuseScore isn't installed, so its pictures are left out");
    return;
  }
  rmSync(OUTPUT, { recursive: true, force: true });
  mkdirSync(OUTPUT, { recursive: true });
  const files = [...new Set(renderings.map(({ mnx }) => mnx))];
  convertToMusicXml(files);
  const drawings = new Map(files.map((file) => [file, draw(file)]));
  for (const rendering of renderings) {
    rendering.museScore = drawings.get(rendering.mnx);
  }
}

function convertToMusicXml(files) {
  spawnSync(TSX, [join(TOOL, "to-musicxml.ts"), OUTPUT, ...files], {
    stdio: "inherit",
  });
}

function draw(mnx) {
  const name = basename(mnx, ".mnx");
  const score = join(OUTPUT, `${name}.musicxml`);
  if (!existsSync(score)) return [];
  const svg = join(OUTPUT, `${name}.svg`);
  spawnSync("mscore", ["-T", TRIM_MARGIN, "-o", svg, score], {
    timeout: TIMEOUT,
    killSignal: "SIGKILL",
  });
  const page = new RegExp(`^${name}-(\\d+)\\.svg$`);
  return readdirSync(OUTPUT)
    .filter((file) => page.test(file))
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }))
    .map((file) => join(OUTPUT, file));
}
