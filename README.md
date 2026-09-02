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


## License

MIT

