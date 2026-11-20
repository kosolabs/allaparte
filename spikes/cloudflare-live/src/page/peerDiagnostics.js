/**
 * How each WebRTC peer connected. The candidate types say which path the
 * connection took: "host" is the local network, "srflx"/"prflx" go through a
 * router's public address (found with STUN), "relay" goes through a TURN
 * server.
 */
export function createPeerDiagnostics() {
  const firstSeen = new Map();
  const connectedAt = new Map();

  function noteSeen(peerIds) {
    for (const id of peerIds) if (!firstSeen.has(id)) firstSeen.set(id, Date.now());
  }

  async function selectedPath(pc) {
    const stats = await pc.getStats();
    let pair = null;
    stats.forEach((report) => {
      if (report.type === "transport" && report.selectedCandidatePairId) pair = stats.get(report.selectedCandidatePairId);
    });
    if (!pair) {
      stats.forEach((report) => {
        if (report.type === "candidate-pair" && report.state === "succeeded" && report.nominated) pair = report;
      });
    }
    if (!pair) return null;
    return {
      local: stats.get(pair.localCandidateId)?.candidateType ?? "?",
      remote: stats.get(pair.remoteCandidateId)?.candidateType ?? "?",
      rttMs: pair.currentRoundTripTime === undefined ? null : Math.round(pair.currentRoundTripTime * 1000),
    };
  }

  async function snapshot(webrtcConns) {
    const rows = [];
    for (const [id, conn] of webrtcConns ?? []) {
      const pc = conn.peer?._pc;
      if (conn.connected && !connectedAt.has(id)) connectedAt.set(id, Date.now());
      const seen = firstSeen.get(id);
      const connected = connectedAt.get(id);
      rows.push({
        id: id.slice(0, 8),
        state: pc?.connectionState ?? "unknown",
        connectMs: seen && connected ? connected - seen : null,
        path: pc ? await selectedPath(pc) : null,
      });
    }
    return rows;
  }

  return { noteSeen, snapshot };
}
