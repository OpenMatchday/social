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

## Official publishing adapters (OM-035)

- Registry: [`providers/registry.json`](providers/registry.json) (D8).
- Adapters for every `policy_verified` provider: YouTube, Instagram, Facebook Pages, TikTok, X, Bluesky.
- Least-privilege OAuth scopes only (`src/oauth.mjs`).
- Encrypted token store: AES-256-GCM + scrypt (`src/tokens.mjs`; Node.js crypto).
- Explicit approval contract: [`contracts/publish-approval.v0.json`](contracts/publish-approval.v0.json) (account, content, visibility; `approved=true` required).
- CI uses **labeled** `MOCK` transport (`mocks/labeled/`, `mock_label=MOCK`, `live=false`). No live network publish in CI.
- Every provider stays `runtime_enabled=false` until owner OAuth credentials exist. Live mode has no default HTTP client.

Unverified providers (Twitch, LinkedIn) have no adapters and cannot publish.

## Connected accounts (OM-036)

- Credential planes (AC-11.1): `app_sign_in`, `social_connections`, `stream_destinations`, `contribution_service` — each gets its own `EncryptedTokenStore` and passphrase (`src/credential-planes.mjs`).
- Connected accounts use **only** `social_connections` (`src/connected-accounts.mjs`).
- UI contract: [`contracts/connected-accounts.v0.json`](contracts/connected-accounts.v0.json) — each row exposes provider, capabilities, status, revoke (AC-11.2).
- Tokens never appear in describe/list payloads. Live OAuth authorize remains owner-gated (`runtime_enabled=false`).

Spike notes: sibling `docs` repo `spikes/d8-social-providers.md`.

## License

MIT. See [LICENSE](LICENSE).
