# Open Matchday -- social

Social content preparation, local export, and official-API publishing adapters.

Part of the [OpenMatchday](https://github.com/OpenMatchday) organization.

## Templates and offline export (OM-034)

Shipped templates (AC-11.3): `announcement`, `lineup`, `score`, `result`, `clip` under [`templates/`](templates/).

- Drafts and local export work with **no account** (AC-11.4).
- Export bundles never include engagement metrics (AC-11.7).
- Graphics card surface is pinned by [`contracts/social-export.v0.json`](contracts/social-export.v0.json) (`social_cards`).

```bash
npm run check
npm test
npm run export:demo
```

## D8 provider registry

Machine-readable verification table: [`providers/registry.json`](providers/registry.json).

- Publishing uses only official APIs marked `policy_verified` (see spike OM-009 / D8).
- Every provider stays `runtime_enabled=false` until OM-035 implements adapters with least-privilege OAuth, encrypted tokens, and explicit publish approval (AC-11.6).
- Unverified providers cannot be enabled.

Spike notes live in the sibling `docs` repo: `spikes/d8-social-providers.md`.

## License

MIT. See [LICENSE](LICENSE).
