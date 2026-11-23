import { createHttpSnapshotClient } from "#viritura/crdt/snapshotClient.ts";
import { IndexeddbPersistence } from "y-indexeddb";
import { WebrtcProvider } from "y-webrtc";
import * as Y from "yjs";
import { exchangeSnapshots } from "./exchange-snapshots.js";

const UPLOAD_DELAY_MS = 1000;
const ICE_SERVERS = [
  { urls: "stun:stun.cloudflare.com:3478" },
  { urls: "stun:stun.l.google.com:19302" },
];

/**
 * A document shared with everyone who opens the same room: kept on the
 * device, caught up through the server, and edited live peer to peer.
 */
export class Room {
  readonly doc = new Y.Doc();
  /** Resolves once there is something to show, or nothing to wait for. */
  readonly ready: Promise<void>;
  readonly #snapshots;
  #provider?: WebrtcProvider;
  #uploadTimer?: ReturnType<typeof setTimeout>;
  #closed = false;

  constructor(id: string) {
    this.#snapshots = createHttpSnapshotClient(`/live/room/${id}/snapshot`);
    this.ready = this.#open(id);
  }

  async close() {
    this.#closed = true;
    this.#provider?.destroy();
    removeEventListener("online", this.#exchange);
    if (this.#uploadTimer) {
      clearTimeout(this.#uploadTimer);
      await this.#exchange();
    }
    this.doc.destroy();
  }

  async #open(id: string) {
    await new IndexeddbPersistence(`room/${id}`, this.doc).whenSynced;
    const onDevice = this.doc.store.clients.size > 0;
    const exchanged = this.#exchange();
    if (!onDevice) await exchanged;
    if (this.#closed) return;

    this.#dropHostClaims();
    this.doc.on("update", this.#scheduleUpload);
    addEventListener("online", this.#exchange);
    this.#provider = new WebrtcProvider(`viritura.live.${id}`, this.doc, {
      signaling: [`${location.origin.replace(/^http/, "ws")}/live/signal`],
      peerOpts: { config: { iceServers: ICE_SERVERS } },
    });
  }

  /** An editor's claim to host the room would lock out later editors. */
  #dropHostClaims() {
    const meta = this.doc.getMap("_meta");
    const drop = () => {
      if (meta.has("hostClientId")) meta.delete("hostClientId");
    };
    meta.observe(drop);
    drop();
  }

  #scheduleUpload = (
    _update: Uint8Array,
    _origin: unknown,
    _doc: Y.Doc,
    transaction: Y.Transaction,
  ) => {
    if (!transaction.local) return;
    clearTimeout(this.#uploadTimer);
    this.#uploadTimer = setTimeout(this.#exchange, UPLOAD_DELAY_MS);
  };

  #exchange = async () => {
    this.#uploadTimer = undefined;
    try {
      await exchangeSnapshots(this.doc, this.#snapshots);
    } catch (cause) {
      console.warn("Couldn't reach the server; will retry later", cause);
    }
  };
}
