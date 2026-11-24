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

To edit a piece with its **Edit in Viritura** button, also run Viritura's editor
against the local server:

```bash
cd vendor/viritura
VITE_VIRITURA_API_BASE_URL=http://localhost:8787 pnpm dev:editor
```

Run `pnpm build:viritura` again whenever `vendor/viritura` changes.
`pnpm test` builds, checks, lints and tests.

To see how the engine draws an MNX file, render it to SVG. This uses the engine
source in `vendor/viritura`, so it needs no `pnpm build:viritura`:

```bash
pnpm render score.mnx
```

If the file has several scores, add the index of one, counting from 0.

## Deploying

Allaparte runs on Cloudflare: the app and its server at `app.allaparte.com`, and
Viritura's editor at `editor.allaparte.com`.

```bash
pnpm deploy:app
pnpm deploy:editor
```

Deploy both when `vendor/viritura` changes. To create an ensemble there, add
`--remote` to `pnpm ensemble:create`.

Setting up a new Cloudflare account, before the first deploy:

```bash
pnpm exec wrangler d1 create allaparte --location wnam
pnpm exec wrangler r2 bucket create allaparte-sounds --location wnam
pnpm exec wrangler r2 object put allaparte-sounds/Shan-SGM-Pro-15.sf2 --remote \
  --file vendor/viritura/packages/audio/assets/sounds/Shan-SGM-Pro-15.sf2
```

Put the database's ID in `wrangler.jsonc`.
