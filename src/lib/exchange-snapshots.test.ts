import type { SnapshotClient } from "#viritura/crdt/snapshotClient.ts";
import { expect, test } from "vitest";
import * as Y from "yjs";
import { exchangeSnapshots } from "./exchange-snapshots.js";

class FakeServer implements SnapshotClient {
  stored: Uint8Array | null = null;
  uploads = 0;

  async fetch() {
    return this.stored;
  }

  async upload(bytes: Uint8Array) {
    this.uploads++;
    this.stored = this.stored ? Y.mergeUpdates([this.stored, bytes]) : bytes;
  }
}

function read(server: FakeServer) {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, server.stored!);
  return doc.getMap("score").toJSON();
}

async function edited(
  server: FakeServer,
  edit: (score: Y.Map<unknown>) => void,
) {
  const doc = new Y.Doc();
  await exchangeSnapshots(doc, server);
  edit(doc.getMap("score"));
  return doc;
}

test("edits made apart reach both devices", async () => {
  const server = new FakeServer();
  const mac = await edited(server, (score) => score.set("mac", 1));
  const iPad = await edited(server, (score) => score.set("iPad", 2));

  await exchangeSnapshots(mac, server);
  await exchangeSnapshots(iPad, server);
  await exchangeSnapshots(mac, server);

  const both = { mac: 1, iPad: 2 };
  expect(mac.getMap("score").toJSON()).toEqual(both);
  expect(iPad.getMap("score").toJSON()).toEqual(both);
  expect(read(server)).toEqual(both);
});

test("uploads a change that only deletes something", async () => {
  const server = new FakeServer();
  const doc = await edited(server, (score) => score.set("note", 1));
  await exchangeSnapshots(doc, server);

  doc.getMap("score").delete("note");
  await exchangeSnapshots(doc, server);

  expect(read(server)).toEqual({});
});

test("doesn't upload when the server is up to date", async () => {
  const server = new FakeServer();
  const doc = await edited(server, (score) => score.set("note", 1));
  await exchangeSnapshots(doc, server);
  await exchangeSnapshots(doc, server);
  await exchangeSnapshots(new Y.Doc(), server);

  expect(server.uploads).toBe(1);
});
