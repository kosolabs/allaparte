import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { byName, readManifest } from "./engine.mjs";
import { recordingOf, treeOf, workingTree } from "./recordings.mjs";
import { writeReport } from "./report.mjs";

const [before, after] = process.argv.slice(2);
if (!before) throw new Error("Usage: pnpm render:diff <before> [after]");
const afterName = after ?? "working tree";

const beforeTree = treeOf(before);
const afterTree = after ? treeOf(after) : workingTree();
const befores = recorded(before, beforeTree);
const afters = recorded(afterName, afterTree);
const changed = changes(befores, afters);
console.log(`${changed.length} of ${afters.size} renderings differ`);
const name = `diff-${beforeTree.slice(0, 8)}-${afterTree.slice(0, 8)}`;
console.log(writeReport(name, `${before} → ${afterName}`, changed));

function recorded(name, tree) {
  const recording = recordingOf(tree);
  if (!existsSync(recording)) {
    throw new Error(
      `${name} isn't recorded. With it in vendor/viritura, run pnpm render:record`,
    );
  }
  return new Map(readManifest(recording).map((entry) => [entry.name, entry]));
}

function changes(befores, afters) {
  const names = new Set([...befores.keys(), ...afters.keys()]);
  return [...names]
    .map((name) => {
      const [before, after] = [befores.get(name), afters.get(name)];
      const images = changedImages(before?.pages ?? [], after?.pages ?? []);
      return { name, mnx: (after ?? before).mnx, images };
    })
    .filter(({ images }) => images.length > 0)
    .sort(byName);
}

function changedImages(before, after) {
  const count = Math.max(before.length, after.length);
  return Array.from({ length: count }, (_, i) => i)
    .filter((i) => !sameDrawing(before[i], after[i]))
    .flatMap((i) => {
      const page = count > 1 ? ` (page ${i + 1})` : "";
      return [
        { label: `Before${page}`, svg: before[i] },
        { label: `After${page}`, svg: after[i] },
      ];
    });
}

function sameDrawing(before, after) {
  if (!before || !after) return false;
  return (
    basename(before) === basename(after) || drawing(before) === drawing(after)
  );
}

// The engine draws some elements in an order that varies between runs.
function drawing(svg) {
  return readFileSync(svg, "utf8").split("\n").sort().join("\n");
}
