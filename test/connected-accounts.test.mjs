import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  CREDENTIAL_PLANES,
  ConnectedAccountsService,
  CredentialStoreRegistry,
  SOCIAL_CONNECTIONS_PLANE,
  loadConnectedAccountsContract,
} from "../src/connected-accounts.mjs"
import { defaultScopesFor } from "../src/oauth.mjs"
import { loadProviderRegistry } from "../src/registry.mjs"

const registry = loadProviderRegistry()

const passphrases = {
  app_sign_in: "om-app-sign-in-pass-01",
  social_connections: "om-social-conn-pass-01",
  stream_destinations: "om-stream-dest-pass-01",
  contribution_service: "om-contrib-svc-pass-01",
}

const makeService = () =>
  new ConnectedAccountsService({
    credentialStores: new CredentialStoreRegistry({
      passphrases,
      clockIso: () => "2026-11-11T12:00:00.000Z",
    }),
    registry,
    clockIso: () => "2026-11-11T12:00:00.000Z",
  })

describe("AC-11.1 separate credential stores", () => {
  it("isolates four credential planes with distinct stores", () => {
    const stores = new CredentialStoreRegistry({ passphrases })
    assert.equal(stores.planesAreIsolated(), true)
    assert.deepEqual([...CREDENTIAL_PLANES], [
      "app_sign_in",
      "social_connections",
      "stream_destinations",
      "contribution_service",
    ])
    const social = stores.storeFor(SOCIAL_CONNECTIONS_PLANE)
    const app = stores.storeFor("app_sign_in")
    social.put("probe", {
      access_token: "social-only-token",
      scopes: defaultScopesFor("youtube", registry),
    })
    assert.equal(social.has("probe"), true)
    assert.equal(app.has("probe"), false)
    assert.equal(stores.storeFor("stream_destinations").has("probe"), false)
    assert.equal(stores.storeFor("contribution_service").has("probe"), false)
  })

  it("rejects shared passphrases across planes", () => {
    assert.throws(
      () =>
        new CredentialStoreRegistry({
          passphrases: {
            ...passphrases,
            stream_destinations: passphrases.app_sign_in,
          },
        }),
      /distinct passphrase/
    )
  })
})

describe("AC-11.2 connected accounts provider/capabilities/status/revoke", () => {
  it("connects on social plane and exposes UI fields without tokens", () => {
    const service = makeService()
    const row = service.connect({
      providerId: "youtube",
      accountLabel: "Harbor Fiction Club",
      accessToken: "yt-test-access-token",
      scopes: defaultScopesFor("youtube", registry),
    })
    assert.equal(row.provider_id, "youtube")
    assert.equal(row.provider_display_name, "YouTube")
    assert.equal(row.account_label, "Harbor Fiction Club")
    assert.ok(row.capabilities.includes("video_upload"))
    assert.ok(
      row.capabilities.includes(
        "https://www.googleapis.com/auth/youtube.upload"
      )
    )
    assert.equal(row.status, "connected_runtime_disabled")
    assert.equal(row.revoke_available, true)
    assert.equal(row.plane, SOCIAL_CONNECTIONS_PLANE)
    assert.equal(service.otherPlanesLack(row.connection_id), true)

    const listed = service.listConnections()
    assert.equal(listed.length, 1)
    const described = service.describe(row.connection_id)
    assert.equal(described.token_encrypted, true)
    assert.equal(JSON.stringify(described).includes("yt-test-access-token"), false)
    assert.equal(JSON.stringify(listed).includes("yt-test-access-token"), false)
  })

  it("revokes connection and clears social store entry", () => {
    const service = makeService()
    const row = service.connect({
      providerId: "bluesky",
      accountLabel: "foxes.bsky.social",
      accessToken: "bsky-test-token",
    })
    const revoked = service.revoke(row.connection_id)
    assert.equal(revoked.ok, true)
    assert.equal(revoked.status, "not_connected")
    assert.equal(service.listConnections().length, 0)
    assert.equal(service.describe(row.connection_id), null)
    assert.equal(service.socialStore.has(row.connection_id), false)
  })

  it("refuses unverified providers and non-social planes", () => {
    const service = makeService()
    assert.throws(
      () =>
        service.connect({
          providerId: "twitch",
          accountLabel: "nope",
          accessToken: "x",
          scopes: ["user:read:email"],
        }),
      /unverified|policy_verified|least privilege/
    )
    assert.throws(
      () => service.assertSocialPlaneOnly("app_sign_in"),
      /social_connections/
    )
  })

  it("loads connected-accounts contract with four planes", () => {
    const contract = loadConnectedAccountsContract()
    assert.equal(contract.contract_id, "open-matchday.connected-accounts")
    assert.deepEqual(contract.credential_planes, [...CREDENTIAL_PLANES])
    for (const field of [
      "provider_id",
      "capabilities",
      "status",
      "revoke_available",
    ]) {
      assert.ok(contract.connection_row_required.includes(field))
    }
  })
})
