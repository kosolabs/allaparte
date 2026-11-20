# Spike: live editing with Viritura

> **Dates:** 2026-11-19. **Question:** Can Allaparte own a piece's document,
> have Viritura's editor open it live, and keep working offline?
> Code: "Spike code.zip" in the [Allaparte Drive folder](https://drive.google.com/drive/folders/1W2D1fX-WCzxiiJ9AjRpBdcPEmCwkJN7_). All
> Viritura code is from commit 90a417c.

## Setup

Viritura's production API only accepts live connections from its own
origins, so everything runs locally, mirroring the planned self-hosting:

- **`relay.js`** stands in for Allaparte's server. It implements the two live
  endpoints Viritura's editor expects (y-webrtc signaling at `/live/signal`
  and a snapshot store at `/live/room/{roomId}/snapshot`), plus `/auth/me`
  answering "signed out".
- **Viritura's editor** runs from source with
  `VITE_VIRITURA_API_BASE_URL=http://localhost:4444`, the same build setting
  a self-hosted editor would use. No Viritura code is changed.
- **The spike page** (Svelte) keeps each piece in IndexedDB, seeds new pieces
  with Viritura's MNX-to-Yjs projection (copied into
  `src/viritura-projection/`), uploads snapshots, and joins the live room.

## Part 1: receiving edits from a Viritura-hosted room

With the editor hosting Beethoven 5, mvt. I, the page loaded the room's
snapshot, connected over WebRTC, and showed each edit about a second after
it was made, for example
`parts/14/measures/1/sequences/0/content/0/notes/0/pitch/octave: update 4 → 5`.

## Part 2: Allaparte hosts, Viritura joins

Allaparte seeded a piece (Beethoven 5 finale, a 751 KB document) and
uploaded it. Editors then opened `http://localhost:5173/#live=<pieceId>`.

| Test | Result |
| --- | --- |
| Editor opens an Allaparte piece as a guest | Works. It loads the score from Allaparte's snapshot and doesn't change the document on joining. |
| Editor edit reaches Allaparte | Works, within about a second. |
| Allaparte edit reaches the editor | Works. The editor redraws the changed note. |
| Allaparte opens with the server unreachable | Works, from the device's IndexedDB copy. |
| Edits made offline, then reconnecting | Works. The server copy ends up with the offline Allaparte edit and the editor's online edits. |
| Editor opens a piece with a stale host claim | **Fails.** See below. |
| Same, with the server removing host claims | Works. The editor stayed in the session for 45 seconds with no interruptions. |

### The host claim

Viritura's editor treats a live room as belonging to one host editor. It
records the host in the document (`_meta.hostClientId`) and ends the session
for everyone else when the host disappears for 1.5 seconds.

A guest editor doesn't claim host when it joins, but it does on its **first
edit** if no host is recorded. In a durable Allaparte piece, that claim
outlives the editor. The next editor to open the piece is told "The host left
the room", ends its session, rejoins from the `#live=` link, and is kicked
again, in a loop.

**Workaround, with no Viritura changes:** Allaparte deletes
`_meta.hostClientId` whenever it appears, in two places:

- **Allaparte clients** delete it as soon as it arrives, which protects
  editors joining while an Allaparte device is online.
- **The server** deletes it whenever it stores a snapshot, which protects
  pieces when only editors are present.

The editor that claimed host keeps working: with no host recorded, it simply
claims again on its next edit, and the claim is removed again.

## Findings

- **No Viritura code changes are needed.** A self-hosted editor built with
  its API address pointed at Allaparte's server can open, edit and
  live-share Allaparte pieces.
- **The snapshot store must merge uploads** (`Y.mergeUpdates`) rather than
  replace them, and **must remove host claims**. Both are a few lines.
- **The snapshot store is required, not optional.** Real scores are hundreds
  of kilobytes to megabytes as Yjs documents, and WebRTC delivers a joining
  peer's starting state as one message, which Chromium caps at 256 KB.
- **The self-hosted editor calls Allaparte's server for everything** that
  normally goes to Viritura's API. Allaparte must at least answer `/auth/me`
  as signed out. Sign-in and GitHub features won't work.
- **Guests need a display name before joining.** The spike preset it; Viritura
  prompts a first-time guest for one. The prompt wasn't exercised here.
- **Change paths use array positions** (`parts/14/measures/1/...`), not IDs,
  because the Yjs document mirrors the MNX JSON. Anything that must survive
  inserted bars, like annotations, must anchor to IDs.
- **Presence lingers.** A closed editor stays listed as present for about 30
  seconds, until its presence times out.
