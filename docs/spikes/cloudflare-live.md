# Spike: live sync on Cloudflare

> **Date:** 2026-11-20. **Question:** Do Allaparte's signaling and snapshot
> store work on Cloudflare, and can real devices on the rehearsal Wi-Fi and
> on cellular connect to each other over WebRTC? Code:
> [`spikes/cloudflare-live/`](../../spikes/cloudflare-live/).

## Setup

One Worker, `allaparte-spike`, served at `spike.allaparte.com` on the
Workers Paid plan:

- **Signaling:** one Durable Object speaking the y-webrtc protocol, using the
  WebSocket Hibernation API. Keepalive pings are answered by Cloudflare's
  automatic response without waking the object. Only same-origin pages and
  room topics in Viritura's format are accepted.
- **Snapshot store:** one Durable Object per room. It merges uploads
  (`Y.mergeUpdates`), removes Viritura host claims, rejects uploads over 5 MB
  or that aren't Yjs updates, and stores the result in 1 MB chunks to stay
  under the per-value storage limit.
- **Test page:** seeds the Beethoven 5 finale (a 751 KB Yjs document), keeps
  a device copy in IndexedDB, joins the room with STUN-only WebRTC, and shows
  each peer's connection state, time to connect and connection path, plus how
  long each edit took to arrive.

## Results

| Device | Network | Result |
| --- | --- | --- |
| Mac | Rehearsal Wi-Fi | Connected to both others |
| iPad | Rehearsal Wi-Fi | Connected to both others |
| iPhone | LTE | Connected to both others |

Edits from each device reached every other device, typically in under
100 ms. No TURN relay was needed, so the rehearsal Wi-Fi doesn't isolate
devices from each other. Locally, two browsers connected in under a second
and edits arrived in 15 to 18 ms, including between Chromium and WebKit.

## Findings

- **WebRTC works on the rehearsal network and across cellular**, so the
  WebRTC sync design stands. The WebSocket design remains the fallback for
  other venues.
- **Safari reports local connections as STUN-derived** (`srflx`/`prflx`)
  rather than `host`, because it hides local addresses. A STUN-derived path
  on an iPad doesn't by itself mean traffic left the local network.
- **Edit latency is measured across devices' clocks**, which agree to within
  tens of milliseconds. "Under 100 ms" is reliable; small differences between
  devices aren't.
- **Only edits made after a device opens a piece count as arrivals.** An
  earlier version also counted old edits replayed from the device's copy, the
  server snapshot or the initial peer sync, and reported them as seconds of
  latency.
- **pnpm's supply-chain policy refuses packages published in the last day**,
  so `wrangler` is pinned to a release at least a day old.

## Not tested

- More than three devices in one room, or a full band.
- Venues other than the rehearsal space.
- The Viritura editor joining through Cloudflare (tested locally in [the
  live-editing spike](viritura-live.md)).
