import { execFileSync } from "node:child_process";
import { join } from "node:path";

export const TOOL = import.meta.dirname;
export const TARGET = join(TOOL, "target");
export const VIRITURA = join(TOOL, "../../vendor/viritura");

export function git(args, env) {
  return execFileSync("git", ["-C", VIRITURA, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}
