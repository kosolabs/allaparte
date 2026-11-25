import { renameSync } from "node:fs";
import { recordTests } from "./engine.mjs";
import { recordingOf, workingTree } from "./recordings.mjs";

const recording = recordingOf(workingTree());
renameSync(recordTests([]), recording);
console.log(recording);
