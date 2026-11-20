# Spike: Viritura monorepo vs standalone repo

> **Date:** 2026-11-18. **Question:** How much overhead does building Allaparte
> as `apps/allaparte` inside the Viritura monorepo add, compared with a
> standalone repo that consumes Viritura's npm packages?

## Method

The same minimal app was built both ways: a React page that loads an MNX file
(and, in the monorepo, MusicXML), strips page layout and engraving choices,
and renders it with a part picker, staff-size control and view modes. Both
versions were rendered in WebKit at iPad size.

- **Monorepo:** worktree `../viritura-allaparte-spike`, branch
  `spike/allaparte-monorepo` (uncommitted), using workspace packages.
- **Standalone:** a scratch folder using `@viritura/score-engine@0.2.0` and
  `@viritura/score-viewer-react@0.1.1` from npm.

Docker isn't installed on this Mac, so the monorepo half ran on the host
instead of through `pnpm dev:stack`. Apple's `container` CLI can't replace
it: the dev stack needs Docker Compose and Traefik's Docker provider, and
`container` 1.7.1 has neither. Its builder also couldn't resolve DNS during
image builds on this machine.

## Results

| Measure                                    | Monorepo                                 | Standalone                     |
| ------------------------------------------ | ---------------------------------------- | ------------------------------ |
| Prerequisites                              | Docker, Git LFS, Node 24 (host-only: Rust WASM target, wasm-pack) | Node                           |
| Dependency install                         | 17 s (warm pnpm cache), 1.1 GB           | 8 s, 126 MB                    |
| WASM build                                 | 78 s cold                                | None (prebuilt in npm package) |
| App typecheck + production build           | 4.5 s                                    | 1.8 s                          |
| JS bundle (gzipped)                        | 272 KB (includes MusicXML converter)     | 179 KB                         |
| First render in WebKit                     | ~2.3 s                                   | ~2.0 s                         |
| UI edit loop                               | Vite hot reload                          | Vite hot reload                |
| Engine (Rust) edit visible in app          | ~47 s                                    | ~52 s with local tarballs      |
| Viewer (TypeScript) edit visible in app    | Hot reload                               | ~5 s rebuild + reinstall       |
| Lint before every push                     | Full-repo `pnpm lint`, ~60 s+            | Whatever Allaparte chooses     |
| MusicXML import                            | Available (`@viritura/musicxml`)         | Not published to npm           |

Rendered output was effectively identical. The published 0.2.0 engine differs
from `main` only in small details such as the rehearsal-mark box style.

### Wiring an app into the monorepo

Beyond the app's own files, adding `apps/allaparte` required changes to:

1. `pnpm-lock.yaml`.
2. `.gitignore` (staged engine assets).
3. `infra/dev/worktree/dev.Dockerfile`, `docker-compose.yml` and `stack.ts`,
   because the dev stack's tests fail `pnpm lint` until every workspace
   package is registered.

Still needed for real use, not done in the spike:

4. A dev-stack service, target and route to run the app through
   `pnpm dev:stack`.
5. `.github/workflows/pr.yml`, whose change detection lists app folders
   explicitly. Changes under `apps/allaparte/` would otherwise trigger no CI.
6. A deploy workflow.

### Friction observed

- **Git hooks** require Git LFS. Without it, every checkout and commit prints
  an error and every push fails.
- **`pnpm lint` fails on this Mac** at the knip step: two editor config files
  run pnpm through Node, which breaks with Homebrew's native pnpm binary.
  This is a host-environment problem, not caused by Allaparte.
- **Viritura's rules** (ESLint, Prettier, barrels, file size) weren't a
  burden for a small app. ESLint passed first time; Prettier needed one
  reformat.

### What worked in both

- **Stripping presentation** in the app: removing `scores[].pages`, Viritura
  layout extensions, explicit beams, stem directions and slur sides. The
  engine re-beamed and re-stemmed correctly, and the part picker,
  transposition and staff-size controls worked.
- **Local Viritura changes in the standalone app:** `pnpm wasm:build`, then
  `pnpm build:npm-packages` (3 s), `pnpm pack` the three score packages, and
  install the tarballs.

## Conclusion

Day-to-day UI work feels the same in both setups. The differences are:

**The monorepo costs** Docker and Git LFS setup, a 1.1 GB install, six
infrastructure files to wire up, a full-repo lint on every push, and running
Allaparte changes through Viritura's PR process.

**The monorepo's real advantages** are direct access to unpublished packages
(the MusicXML converter, the CRDT code, UI components) and hot reload when
changing Viritura's viewer code.

Both are available without the monorepo: build the packages Allaparte needs
from a pinned Viritura commit, as the local-tarball test above did.

**Recommendation:** build Allaparte as a standalone repo.
