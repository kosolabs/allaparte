<script>
  import * as Y from "yjs";
  import { WebrtcProvider } from "y-webrtc";
  import { IndexeddbPersistence } from "y-indexeddb";
  import { syncJsonToYDoc } from "./viritura-projection/syncJsonToYDoc";
  import { createPeerDiagnostics } from "./peerDiagnostics";

  const PIECE_ID = /[a-z2-9]{16}/;
  const ID_CHARSET = "abcdefghijkmnpqrstuvwxyz23456789";
  const NAME_KEY = "allaparte.spike.name";
  const SIGNALING_URL = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/live/signal`;
  const ICE_SERVERS = [{ urls: "stun:stun.cloudflare.com:3478" }, { urls: "stun:stun.l.google.com:19302" }];
  const SEED = "allaparte:seed";
  const EDIT = "allaparte:edit";
  const SNAPSHOT = "allaparte:snapshot";

  let name = $state(localStorage.getItem(NAME_KEY) ?? "");
  let nameSaved = $state(name !== "");
  let ready = $state(false);
  let pieceId = $state(location.hash.match(PIECE_ID)?.[0] ?? null);
  let deviceStatus = $state("–");
  let serverStatus = $state("–");
  let signalingStatus = $state("–");
  let docBytes = $state(0);
  let peerNames = $state([]);
  let peers = $state([]);
  let arrivals = $state([]);
  let doc = null;
  let provider = null;
  let persistence = null;
  let uploadTimer = null;
  let openedAt = 0;
  const diagnostics = createPeerDiagnostics();

  function newPieceId() {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return [...bytes].map((byte) => ID_CHARSET[byte % ID_CHARSET.length]).join("");
  }

  function snapshotUrl() {
    return `/live/room/${pieceId}/snapshot`;
  }

  async function uploadSnapshot() {
    try {
      const response = await fetch(snapshotUrl(), { method: "PUT", body: Y.encodeStateAsUpdate(doc) });
      serverStatus = response.ok ? `saved at ${new Date().toLocaleTimeString()}` : `save failed (${response.status})`;
    } catch {
      serverStatus = "unreachable; edits kept on this device";
    }
  }

  function scheduleUpload() {
    clearTimeout(uploadTimer);
    uploadTimer = setTimeout(uploadSnapshot, 1000);
  }

  function watchEdits() {
    doc.getMap("spike").observe((_event, transaction) => {
      if (transaction.local) return;
      const edit = doc.getMap("spike").get("lastEdit");
      if (!edit || edit.at < openedAt) return;
      const entry = `${new Date().toLocaleTimeString()}: edit from ${edit.by} arrived after ${Date.now() - edit.at} ms`;
      arrivals = [entry, ...arrivals].slice(0, 10);
    });
    doc.on("update", (_update, origin) => {
      docBytes = Y.encodeStateAsUpdate(doc).byteLength;
      if (origin === SEED || origin === EDIT) scheduleUpload();
    });
  }

  function joinLiveRoom() {
    provider = new WebrtcProvider(`viritura.live.${pieceId}`, doc, {
      signaling: [SIGNALING_URL],
      peerOpts: { config: { iceServers: ICE_SERVERS } },
    });
    provider.awareness.setLocalState({ identity: { displayName: name } });
    provider.awareness.on("change", () => {
      peerNames = [...provider.awareness.getStates().entries()]
        .filter(([clientId]) => clientId !== doc.clientID)
        .map(([, state]) => state?.identity?.displayName ?? "?");
    });
    provider.on("peers", ({ added }) => diagnostics.noteSeen(added));
    setInterval(async () => {
      signalingStatus = provider.signalingConns.some((conn) => conn.connected) ? "connected" : "not connected";
      peers = await diagnostics.snapshot(provider.room?.webrtcConns);
    }, 1000);
  }

  async function openPiece(id, seedJson) {
    pieceId = id;
    openedAt = Date.now();
    history.replaceState(null, "", `#piece=${id}`);
    doc = new Y.Doc();
    watchEdits();

    persistence = new IndexeddbPersistence(`allaparte.piece.${id}`, doc);
    await persistence.whenSynced;
    deviceStatus = `loaded ${Y.encodeStateAsUpdate(doc).byteLength.toLocaleString()} bytes`;
    if (seedJson) doc.transact(() => syncJsonToYDoc(seedJson, doc, "score"), SEED);

    try {
      const response = await fetch(snapshotUrl());
      if (response.ok) Y.applyUpdate(doc, new Uint8Array(await response.arrayBuffer()), SNAPSHOT);
      serverStatus = response.ok ? "snapshot loaded" : "no snapshot yet";
      await uploadSnapshot();
    } catch {
      serverStatus = "unreachable; working from this device's copy";
    }
    joinLiveRoom();
    ready = true;
  }

  async function newPieceFromSample() {
    const json = await (await fetch("/sample.mnx")).json();
    await openPiece(newPieceId(), json);
  }

  function raiseFirstNote() {
    const content = doc.getMap("score").get("parts").get(0).get("measures").get(0).get("sequences").get(0).get("content");
    const event = content.toArray().find((item) => item.get("notes")?.length > 0);
    const pitch = event.get("notes").get(0).get("pitch");
    doc.transact(() => {
      pitch.set("octave", pitch.get("octave") + 1);
      doc.getMap("spike").set("lastEdit", { by: name, at: Date.now() });
    }, EDIT);
  }

  async function shareLink() {
    if (navigator.share) await navigator.share({ title: "Allaparte live spike", url: location.href });
    else await navigator.clipboard.writeText(location.href);
  }

  function saveName() {
    localStorage.setItem(NAME_KEY, name);
    nameSaved = true;
    if (pieceId) openPiece(pieceId);
  }

  const describePath = (path) => (path ? `${path.local} ↔ ${path.remote}${path.rttMs === null ? "" : `, ${path.rttMs} ms round trip`}` : "–");

  if (pieceId && nameSaved) openPiece(pieceId);
</script>

<main>
  <h1>Allaparte live spike</h1>

  {#if !nameSaved}
    <form onsubmit={(event) => (event.preventDefault(), saveName())}>
      <label>Device name <input bind:value={name} placeholder="e.g. Shad's iPad" required /></label>
      <button>Continue</button>
    </form>
  {:else if !pieceId}
    <p>Signed in as <strong>{name}</strong>.</p>
    <button onclick={newPieceFromSample}>New piece from sample</button>
  {:else}
    <p class="actions">
      <button onclick={shareLink}>Share link</button>
      <button onclick={raiseFirstNote} disabled={!ready}>Raise first note an octave</button>
    </p>

    <section>
      <h2>Status</h2>
      <dl>
        <dt>This device</dt><dd>{name}, piece {pieceId}</dd>
        <dt>Signaling</dt><dd>{signalingStatus}</dd>
        <dt>Device copy</dt><dd>{deviceStatus}</dd>
        <dt>Server snapshot</dt><dd>{serverStatus}</dd>
        <dt>Document</dt><dd>{docBytes.toLocaleString()} bytes</dd>
        <dt>Others present</dt><dd>{peerNames.join(", ") || "–"}</dd>
      </dl>
    </section>

    <section>
      <h2>WebRTC peers ({peers.length})</h2>
      {#if peers.length === 0}
        <p>No peers yet. Open the shared link on another device.</p>
      {:else}
        <table>
          <thead><tr><th>Peer</th><th>State</th><th>Time to connect</th><th>Path (this ↔ peer)</th></tr></thead>
          <tbody>
            {#each peers as peer (peer.id)}
              <tr>
                <td>{peer.id}</td>
                <td class={peer.state}>{peer.state}</td>
                <td>{peer.connectMs === null ? "–" : `${peer.connectMs} ms`}</td>
                <td>{describePath(peer.path)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </section>

    <section>
      <h2>Edits from other devices</h2>
      {#if arrivals.length === 0}
        <p>None yet.</p>
      {:else}
        <ol>
          {#each arrivals as arrival, index (index)}<li>{arrival}</li>{/each}
        </ol>
      {/if}
    </section>
  {/if}
</main>

<style>
  main {
    font-family: system-ui, sans-serif;
    font-size: 18px;
    max-width: 900px;
    padding: 0 16px;
  }
  button {
    font-size: 18px;
    padding: 12px 18px;
    margin-right: 8px;
  }
  input {
    font-size: 18px;
    padding: 8px;
  }
  dl {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 4px 16px;
  }
  dt {
    font-weight: 600;
  }
  table {
    border-collapse: collapse;
    width: 100%;
  }
  th,
  td {
    border-bottom: 1px solid #ddd;
    padding: 6px;
    text-align: left;
  }
  .connected {
    color: #0a5;
  }
  .failed,
  .disconnected {
    color: #b00020;
  }
</style>
