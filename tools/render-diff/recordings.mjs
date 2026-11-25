import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { git, TARGET, TOOL, VIRITURA } from "./environment.mjs";

const RECORDINGS = join(TARGET, "recordings");
const RECORDER = ["engine.mjs", "recorder.rs"];

export function recordingOf(tree) {
  mkdirSync(RECORDINGS, { recursive: true });
  return join(RECORDINGS, `${tree}-${recorderHash()}.jsonl`);
}

function recorderHash() {
  const hash = createHash("sha256");
  for (const file of RECORDER) hash.update(readFileSync(join(TOOL, file)));
  return hash.digest("hex").slice(0, 8);
}

export function treeOf(ref) {
  return git(["rev-parse", "--verify", `${ref}^{tree}`]).trim();
}

export function workingTree() {
  mkdirSync(TARGET, { recursive: true });
  const index = join(TARGET, "git-index");
  copyFileSync(
    resolve(VIRITURA, git(["rev-parse", "--git-path", "index"]).trim()),
    index,
  );
  const env = { GIT_INDEX_FILE: index };
  git(["add", "--all"], env);
  const tree = git(["write-tree"], env).trim();
  rmSync(index);
  return tree;
}
