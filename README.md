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

To see what some of the engine's tests draw, give parts of their names:

```bash
pnpm render:test <test>... [--musescore]
```

This tests the working tree of `vendor/viritura`. With `--musescore`, it also
shows MuseScore's drawing of each whole score, converted to MusicXML by
`vendor/viritura`. That needs MuseScore installed as `mscore`.

To see what an engine change does to the drawings of every test, record them
before and after the change, then compare:

```bash
pnpm render:record
pnpm render:diff <before> [after]
```

`render:record` records the working tree, which takes about three minutes.
`render:diff` compares two recorded commits; `after` is the working tree unless
given. If MuseScore is installed, its drawings are included. A new test only has
a "before" drawing if it is in the `before` commit, so commit the test ahead of
the fix. Recordings are kept in `tools/render-diff/target`, which is safe to
delete.

`render:test` and `render:diff` write to `tools/render-diff/target/report`:
`index.html`, and `report.md` to add to a pull request:

```bash
cd tools/render-diff/target/report
gh pr edit <number> --body-file report.md --attach files/<picture>.svg
```

`--body-file` replaces the description, so put the rest of it in `report.md`
first, and repeat `--attach` for each picture.

## Deploying

Allaparte runs on Cloudflare: the app and its server at `app.allaparte.com`, and
Viritura's editor at `editor.allaparte.com`. Merging to `main` deploys both, once
the tests pass. D1 migrations apply before the new server starts, so they must
also work with the old one.

To create an ensemble there, add `--remote` to `pnpm ensemble:create`.

Setting up a new Cloudflare account, before the first deploy:

```bash
pnpm exec wrangler d1 create allaparte --location wnam
pnpm exec wrangler r2 bucket create allaparte-sounds --location wnam
pnpm exec wrangler r2 object put allaparte-sounds/Shan-SGM-Pro-15.sf2 --remote \
  --file vendor/viritura/packages/audio/assets/sounds/Shan-SGM-Pro-15.sf2
```

Put the database's ID in `wrangler.jsonc`. In the `allaparte-release` GitHub
environment, set the secrets `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`,
an account API token that can edit Workers, Workers routes and D1.
