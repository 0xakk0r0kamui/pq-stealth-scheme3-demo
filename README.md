# Scheme 3 demo

Browser demo of ERC-5564 scheme 3 on the ERC-5564 announcer and ERC-6538
registry. Alice pays Bob; each mined transaction is checked against the plugin
output.

Depends on `@kohaku-eth/pq-stealth-scheme3` from
[GitHub Releases](https://github.com/0xakk0r0kamui/kohaku-sapq/releases/tag/pq-stealth-scheme3-v0.1.1),
plus `@kohaku-eth/plugins`, `@kohaku-eth/provider`, and `viem`.

## Run

Node 22:

```bash
corepack pnpm@10.28.0 install
corepack pnpm@10.28.0 dev
```

`pnpm run setup:local` packs a sibling `kohaku-sapq` checkout instead of the
release tarball.

## GitHub Pages

`.github/workflows/pages.yml` deploys `dist/` (`base: './'`).

```bash
git init -b main
git add .
git commit -m "Scheme 3 browser demo"
gh repo create pq-stealth-scheme3-demo --public --source . --remote origin --push
```

Settings → Pages → Source: GitHub Actions.

```text
https://0xakk0r0kamui.github.io/pq-stealth-scheme3-demo/
```

The RPC must be HTTPS and allow CORS.

## License

MIT

