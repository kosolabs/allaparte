import { cp, mkdir, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dist = dirname(
  fileURLToPath(import.meta.resolve("@viritura/score-engine")),
);
const target = fileURLToPath(
  new URL("../static/score-engine/", import.meta.url),
);

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
for (const asset of ["wasm", "fonts", "score-engine.worker.js"]) {
  await cp(`${dist}/${asset}`, `${target}${asset}`, { recursive: true });
}
