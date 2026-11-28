import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";
import { generateRoomId } from "../vendor/viritura/packages/crdt/src/roomId.ts";

const { values, positionals } = parseArgs({
  options: { remote: { type: "boolean" } },
  allowPositionals: true,
});
const name = positionals[0];
if (!name) throw new Error('Usage: pnpm ensemble:create "Name" [--remote]');

const id = generateRoomId();
const quoted = `'${name.replaceAll("'", "''")}'`;
execFileSync(
  "wrangler",
  [
    "d1",
    "execute",
    "allaparte",
    values.remote ? "--remote" : "--local",
    "--command",
    `INSERT INTO ensembles (id, name) VALUES ('${id}', ${quoted});
     INSERT INTO rooms (id, ensemble_id) VALUES ('${id}', '${id}');`,
  ],
  { stdio: ["ignore", "ignore", "inherit"] },
);

const app = values.remote
  ? "https://app.allaparte.com"
  : "http://localhost:5180";
console.log(`${name}: ${app}/e/${id}`);
