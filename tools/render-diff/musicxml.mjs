import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { basename, join } from "node:path";
import { TARGET, TOOL, VIRITURA } from "./environment.mjs";

const TSX = join(VIRITURA, "node_modules/.bin/tsx");
const OUTPUT = join(TARGET, "musicxml");

/** Converts each MNX file it can, and maps it to its MusicXML file. */
export function convertToMusicXml(files) {
  rmSync(OUTPUT, { recursive: true, force: true });
  mkdirSync(OUTPUT, { recursive: true });
  spawnSync(TSX, [join(TOOL, "to-musicxml.ts"), OUTPUT, ...files], {
    stdio: "inherit",
  });
  return new Map(
    files
      .map((file) => [file, join(OUTPUT, `${basename(file, ".mnx")}.musicxml`)])
      .filter(([, score]) => existsSync(score)),
  );
}
