import { cp, mkdir, rm } from "node:fs/promises";

const dist = new URL(
  "../vendor/viritura/packages/score-engine/dist/",
  import.meta.url,
);
const target = new URL("../static/score-engine/", import.meta.url);

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
for (const asset of ["wasm", "fonts", "score-engine.worker.js"]) {
  await cp(new URL(asset, dist), new URL(asset, target), { recursive: true });
}
