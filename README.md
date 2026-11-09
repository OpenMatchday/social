# Open Matchday -- social

Social content preparation, local export, and official-API publishing adapters.

Part of the [OpenMatchday](https://github.com/OpenMatchday) organization.

## D8 provider registry

Machine-readable verification table: [`providers/registry.json`](providers/registry.json).

- Publishing uses only official APIs marked `policy_verified` (see spike OM-009 / D8).
- Every provider stays `runtime_enabled=false` until OM-035 implements adapters with least-privilege OAuth, encrypted tokens, and explicit publish approval (AC-11.6).
- Unverified providers cannot be enabled.

Validate locally:

```bash
npm run check
```

Spike notes live in the sibling `docs` repo: `spikes/d8-social-providers.md`.

## License

MIT. See [LICENSE](LICENSE).
