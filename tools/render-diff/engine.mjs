import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { git, TARGET, TOOL, VIRITURA } from "./environment.mjs";

const COPY = join(TARGET, "working-tree");
const ENGINE = "engine/viritura-engine";
const MANIFEST = join(TARGET, "manifest.jsonl");
const PICTURES = join(TARGET, "pictures");

const parse = (name) => ({ name, recorder: "parse(root_json.to_string()" });
const layout = (name) => ({ name, recorder: "layout(score" });

const INSTRUMENTS = {
  "lib.rs": (code) => `${code}\nmod recorder;\n`,
  "promote/root.rs": recordCalls(parse("promote_root")),
  "layout.rs": recordCalls(layout("layout_score_cached")),
  "layout/full_score.rs": recordCalls(layout("layout_full_score_cached")),
  "layout/mnx_layout/explicit.rs": recordCalls(
    layout("layout_with_mnx_scores_cached"),
  ),
};

function recordCalls({ name, recorder }) {
  const signature = new RegExp(`pub fn ${name}\\(([^)]*)\\) -> ([^{]+) \\{`);
  return (code) => {
    if (!signature.test(code)) throw new Error(`Can't find ${name}`);
    return code.replace(signature, (_, parameters, result) => {
      const names = parameters.matchAll(/(\w+):(?!:)/g);
      const args = [...names].map(([, parameter]) => parameter).join(", ");
      return `pub fn ${name}(${parameters.replace(/\bmut (?=\w+: )/, "")}) -> ${result} {
    crate::recorder::${recorder}, || ${name}_unrecorded(${args}))
}

fn ${name}_unrecorded(${parameters}) -> ${result} {`;
    });
  };
}

export function recordTests(tests) {
  copyWorkingTree();
  mkdirSync(PICTURES, { recursive: true });
  rmSync(MANIFEST, { force: true });
  const args = ["test", "--quiet", "--lib", "--", ...tests];
  const { status } = spawnSync("cargo", args, {
    cwd: join(COPY, ENGINE),
    stdio: ["ignore", "inherit", "inherit"],
    env: {
      ...process.env,
      CARGO_TARGET_DIR: join(TARGET, "cargo"),
      RECORDER_MANIFEST: MANIFEST,
      RECORDER_PICTURES: PICTURES,
      RUSTFLAGS: "--cap-lints allow",
    },
  });
  if (!existsSync(MANIFEST)) throw new Error("No test drew anything");
  if (status !== 0) console.warn("Some tests fail");
  return MANIFEST;
}

// Leaves unchanged files alone, so that Cargo only rebuilds what changed.
function copyWorkingTree() {
  mkdirSync(COPY, { recursive: true });
  for (const entry of readdirSync(VIRITURA)) {
    const link = join(COPY, entry);
    if (entry !== "engine" && !existsSync(link)) {
      symlinkSync(join(VIRITURA, entry), link);
    }
  }
  for (const file of engineFiles()) {
    const content = readFileSync(join(VIRITURA, file));
    const instrument = INSTRUMENTS[relative(join(ENGINE, "src"), file)];
    writeChanged(
      join(COPY, file),
      instrument ? Buffer.from(instrument(content.toString())) : content,
    );
  }
  writeChanged(
    join(COPY, ENGINE, "src/recorder.rs"),
    readFileSync(join(TOOL, "recorder.rs")),
  );
}

function engineFiles() {
  const args = ["ls-files", "-z", "--cached", "--others", "--exclude-standard"];
  return git([...args, "engine"])
    .split("\0")
    .filter((file) => file && existsSync(join(VIRITURA, file)));
}

function writeChanged(path, content) {
  if (existsSync(path) && readFileSync(path).equals(content)) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

export function readManifest(manifest) {
  const lines = readFileSync(manifest, "utf8").trim().split("\n");
  const path = (file) => join(PICTURES, file);
  return lines
    .map((line) => JSON.parse(line))
    .map(({ test, call, mnx, pages }) => ({
      name: `${test} #${call}`,
      mnx: path(mnx),
      pages: pages.map(path),
    }));
}

export function byName(a, b) {
  return a.name.localeCompare(b.name, "en", { numeric: true });
}
