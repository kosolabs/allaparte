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

Run `pnpm build:viritura` again whenever `vendor/viritura` changes.
`pnpm test` builds, checks, lints and tests.
