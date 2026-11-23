# Allaparte

Everyone in an ensemble reads the same up-to-date score, and each musician
controls how their part looks. See [the design](docs/design.md).

## Setup

Needs Node 24 with Corepack, Git LFS, [rustup](https://rustup.rs) and
[wasm-pack](https://github.com/wasm-bindgen/wasm-pack).

```bash
git submodule update --init
pnpm install
pnpm build:viritura
pnpm dev
```

`pnpm dev` runs the app and a local copy of its server. Create an ensemble and
open the link it prints:

```bash
pnpm ensemble:create "Name"
```

To edit a piece, run Viritura's editor against the local server, then open
`http://localhost:5173/#live=<piece ID>`, where the piece ID is the last part
of the piece's address:

```bash
cd vendor/viritura
VITE_VIRITURA_API_BASE_URL=http://localhost:8787 pnpm dev:editor
```

Run `pnpm build:viritura` again whenever `vendor/viritura` changes.
`pnpm test` builds, checks, lints and tests.
