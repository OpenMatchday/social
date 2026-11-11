import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import {
  assertLabeledMock,
  createLabeledMockTransport,
  MOCK_LABEL,
} from "../src/adapters/mock-transport.mjs"
import { listAdapterProviderIds } from "../src/adapters/catalog.mjs"
import {
  assertPublishApproved,
  buildPublishApproval,
} from "../src/approval.mjs"
import { assertLeastPrivilegeScopes, defaultScopesFor } from "../src/oauth.mjs"
import { publishDraft } from "../src/publish.mjs"
import { loadProviderRegistry } from "../src/registry.mjs"
import { EncryptedTokenStore } from "../src/tokens.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const registry = loadProviderRegistry()
const passphrase = "om-social-ci-test-passphrase"

const approvalFor = (providerId, { approved = true } = {}) =>
  buildPublishApproval({
    account: {
      provider_id: providerId,
      account_label: `${providerId}-test`,
      connection_id: `conn-${providerId}`,
    },
    content: {
      draft_id: "draft-1",
      kind: "result",
      caption: "Foxes 78-71 Cats",
      media_refs: ["file://local/card.png"],
    },
    visibility: "private",
    approved,
    approvedAt: "2026-11-11T10:00:00.000Z",
  })

const storeWithToken = (providerId) => {
  const store = new EncryptedTokenStore({
    passphrase,
    clockIso: () => "2026-11-11T09:59:00.000Z",
  })
  store.put(`conn-${providerId}`, {
    access_token: `test-token-${providerId}`,
    refresh_token: null,
    scopes: defaultScopesFor(providerId, registry),
    expires_at: null,
  })
  return store
}

describe("least-privilege OAuth (AC-11.5)", () => {
  it("accepts registry scopes and rejects extras", () => {
    const scopes = defaultScopesFor("youtube", registry)
    assert.deepEqual(
      assertLeastPrivilegeScopes("youtube", scopes, registry),
      scopes
    )
    assert.throws(
      () =>
        assertLeastPrivilegeScopes(
          "youtube",
          [...scopes, "https://www.googleapis.com/auth/youtube.force-ssl"],
          registry
        ),
      /least privilege/
    )
  })
})

describe("encrypted token storage (AC-11.5)", () => {
  it("round-trips tokens without exposing plaintext in envelopes", () => {
    const store = storeWithToken("bluesky")
    const meta = store.describe("conn-bluesky")
    assert.equal(meta.encrypted, true)
    assert.equal(meta.alg, "aes-256-gcm")
    const envelopeJson = JSON.stringify(store.exportEnvelopes())
    assert.equal(envelopeJson.includes("test-token-bluesky"), false)
    const unlocked = store.unlock("conn-bluesky")
    assert.equal(unlocked.access_token, "test-token-bluesky")
    store.revoke("conn-bluesky")
    assert.equal(store.has("conn-bluesky"), false)
  })
})

describe("explicit publish approval (AC-11.6)", () => {
  it("requires account, content, visibility, and approved=true", () => {
    const pending = approvalFor("x", { approved: false })
    assert.throws(() => assertPublishApproved(pending), /explicit approval/)
    const ok = approvalFor("x", { approved: true })
    assert.equal(assertPublishApproved(ok).approved, true)
    assert.equal(ok.account.account_label, "x-test")
    assert.equal(ok.content.caption, "Foxes 78-71 Cats")
    assert.equal(ok.visibility, "private")
  })
})

describe("official adapters with labeled mocks (CI)", () => {
  it("publishes via MOCK transport for every policy_verified adapter", async () => {
    const fixture = JSON.parse(
      readFileSync(join(root, "mocks", "labeled", "publish-ok.json"), "utf8")
    )
    assert.equal(fixture.mock_label, MOCK_LABEL)

    for (const providerId of listAdapterProviderIds()) {
      const transport = createLabeledMockTransport({
        responses: { publish: fixture },
      })
      const outcome = await publishDraft({
        approval: approvalFor(providerId),
        tokenStore: storeWithToken(providerId),
        mode: "mock",
        transport,
        registry,
      })
      assert.equal(outcome.ok, true)
      assert.equal(outcome.mode, "mock")
      assert.equal(outcome.provider_id, providerId)
      assertLabeledMock(outcome.result)
      assert.equal(outcome.result.mock_label, MOCK_LABEL)
      assert.equal(transport.calls().length, 1)
      assert.equal(transport.calls()[0].payload.has_access_token, true)
      assert.equal(
        JSON.stringify(outcome).includes(`test-token-${providerId}`),
        false
      )
    }
  })

  it("blocks live publish while runtime_enabled=false", async () => {
    await assert.rejects(
      () =>
        publishDraft({
          approval: approvalFor("youtube"),
          tokenStore: storeWithToken("youtube"),
          mode: "live",
          transport: {
            live: true,
            async request() {
              return { live: true, ok: true }
            },
          },
          registry,
        }),
      /runtime_enabled=false/
    )
  })

  it("rejects unverified providers", async () => {
    const store = new EncryptedTokenStore({ passphrase })
    store.put("conn-twitch", {
      access_token: "nope",
      scopes: ["user:read:email"],
    })
    await assert.rejects(
      () =>
        publishDraft({
          approval: buildPublishApproval({
            account: {
              provider_id: "twitch",
              account_label: "twitch",
              connection_id: "conn-twitch",
            },
            content: {
              draft_id: "d",
              kind: "clip",
              caption: "x",
            },
            visibility: "private",
            approved: true,
            approvedAt: "2026-11-11T10:00:00.000Z",
          }),
          tokenStore: store,
          mode: "mock",
          registry,
        }),
      /no official adapter|policy_verified/
    )
  })
})
