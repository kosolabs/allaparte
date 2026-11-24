import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";
import { writeHtml, writeMarkdown } from "./report.mjs";

const TOOL = import.meta.dirname;
const VIRITURA = join(TOOL, "../../vendor/viritura");
const TARGET = join(TOOL, "target");
const REPORT = join(TARGET, "report");
const LAYOUT_FUNCTIONS = {
  "layout.rs": "layout_score_cached",
  "layout/full_score.rs": "layout_full_score_cached",
  "layout/mnx_layout/explicit.rs": "layout_with_mnx_scores_cached",
};

const [before, after] = process.argv.slice(2);
if (!before) throw new Error("Usage: pnpm render:diff <before> [after]");

const refs = { before, after: after ?? workingTree() };
const recordings = Object.entries(refs).map(([side, ref]) => {
  const engine = checkOut(side, ref);
  instrument(engine);
  return recordTests(side, engine);
});
const renderings = compare(...recordings);

rmSync(REPORT, { recursive: true, force: true });
mkdirSync(REPORT, { recursive: true });
const title = `${before} → ${after ?? "working tree"}`;
writeHtml(REPORT, title, renderings);
writeMarkdown(REPORT, renderings);

const changed = renderings.filter((rendering) => rendering.changed);
console.log(`${changed.length} of ${renderings.length} renderings differ`);
console.log(join(REPORT, "index.html"));

function workingTree() {
  return git("stash", "create").trim() || "HEAD";
}

function checkOut(side, ref) {
  const directory = join(TARGET, side);
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });
  const archive = join(TARGET, `${side}.tar`);
  git("archive", "--output", archive, ref);
  execFileSync("tar", ["-xf", archive, "-C", directory]);
  rmSync(archive);
  return join(directory, "engine/viritura-engine");
}

function git(...args) {
  return execFileSync("git", ["-C", VIRITURA, ...args], { encoding: "utf8" });
}

function instrument(engine) {
  const source = join(engine, "src");
  copyFileSync(join(TOOL, "recorder.rs"), join(source, "recorder.rs"));
  edit(join(source, "lib.rs"), (code) => `${code}\nmod recorder;\n`);
  for (const [file, name] of Object.entries(LAYOUT_FUNCTIONS)) {
    edit(join(source, file), (code) => recordCalls(code, name));
  }
}

function edit(file, change) {
  writeFileSync(file, change(readFileSync(file, "utf8")));
}

function recordCalls(code, name) {
  const signature = new RegExp(
    `pub fn ${name}\\(([^)]*)\\) -> DisplayList \\{`,
  );
  if (!signature.test(code)) throw new Error(`Can't find ${name}`);
  return code.replace(signature, (_, parameters) => {
    const names = parameters.matchAll(/(\w+):(?!:)/g);
    const args = [...names].map(([, parameter]) => parameter).join(", ");
    return `pub fn ${name}(${parameters.replace(/\bmut (?=\w+: )/, "")}) -> DisplayList {
    crate::recorder::record(score, || ${name}_unrecorded(${args}))
}

fn ${name}_unrecorded(${parameters}) -> DisplayList {`;
  });
}

function recordTests(side, engine) {
  console.log(`Running the tests ${side}`);
  const output = join(TARGET, `${side}-renderings`);
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output);
  const { status } = spawnSync("cargo", ["test", "--quiet", "--lib"], {
    cwd: engine,
    stdio: ["ignore", "inherit", "inherit"],
    env: {
      ...process.env,
      CARGO_TARGET_DIR: join(TARGET, "cargo"),
      RENDER_DIFF_OUTPUT: output,
      RUSTFLAGS: "--cap-lints allow",
    },
  });
  const manifest = join(output, "manifest.jsonl");
  if (!existsSync(manifest)) throw new Error("The tests didn't run");
  if (status !== 0) console.warn(`Some tests fail ${side}`);
  const lines = readFileSync(manifest, "utf8").trim().split("\n");
  return lines.map((line) => {
    const { test, call, mnx, pages } = JSON.parse(line);
    const path = (file) => join(output, file);
    return { name: `${test} #${call}`, mnx: path(mnx), pages: pages.map(path) };
  });
}

function compare(before, after) {
  const byName = (recording) => new Map(recording.map((r) => [r.name, r]));
  const [befores, afters] = [byName(before), byName(after)];
  const names = new Set([...befores.keys(), ...afters.keys()]);
  const inOrder = (a, b) => a.localeCompare(b, "en", { numeric: true });
  return [...names].sort(inOrder).map((name) => {
    const [b, a] = [befores.get(name), afters.get(name)];
    const count = Math.max(b?.pages.length ?? 0, a?.pages.length ?? 0);
    const pages = Array.from({ length: count }, (_, i) => ({
      number: i + 1,
      before: b?.pages[i],
      after: a?.pages[i],
    })).map((page) => ({
      ...page,
      changed: !sameDrawing(page),
    }));
    const changed = pages.some((page) => page.changed);
    return { name, mnx: (a ?? b).mnx, changed, pages };
  });
}

function sameDrawing({ before, after }) {
  if (!before || !after) return false;
  return (
    basename(before) === basename(after) || drawing(before) === drawing(after)
  );
}

// The engine draws some elements in an order that varies between runs.
function drawing(svg) {
  return readFileSync(svg, "utf8").split("\n").sort().join("\n");
}
