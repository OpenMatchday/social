import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  CREDENTIAL_PLANES,
  CredentialStoreRegistry,
  SOCIAL_CONNECTIONS_PLANE,
} from "./credential-planes.mjs"
import { assertLeastPrivilegeScopes } from "./oauth.mjs"
import { getProvider, loadProviderRegistry } from "./registry.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

export const loadConnectedAccountsContract = () =>
  JSON.parse(
    readFileSync(join(root, "contracts", "connected-accounts.v0.json"), "utf8")
  )

const capabilitiesFor = (provider) => {
  const useCases = Array.isArray(provider.use_cases) ? provider.use_cases : []
  const scopes = Array.isArray(provider.oauth_scopes_least_privilege)
    ? provider.oauth_scopes_least_privilege
    : []
  return [...useCases, ...scopes]
}

const statusFor = (provider, hasToken) => {
  if (!hasToken) {
    return "not_connected"
  }
  if (provider.runtime_enabled !== true) {
    return "connected_runtime_disabled"
  }
  return "connected"
}

/**
 * Connected accounts for the social_connections plane (AC-11.1, AC-11.2).
 * Never accepts tokens into other credential planes.
 */
export class ConnectedAccountsService {
  constructor({
    credentialStores,
    registry = loadProviderRegistry(),
    clockIso,
  } = {}) {
    if (!(credentialStores instanceof CredentialStoreRegistry)) {
      throw new Error("CredentialStoreRegistry required")
    }
    if (!credentialStores.planesAreIsolated()) {
      throw new Error("credential planes must be isolated")
    }
    this._stores = credentialStores
    this._registry = registry
    this._clockIso = clockIso ?? (() => new Date().toISOString())
    this._meta = new Map()
    this._seq = 0
  }

  get socialStore() {
    return this._stores.storeFor(SOCIAL_CONNECTIONS_PLANE)
  }

  /** Refuse to use non-social planes for publishing connections. */
  assertSocialPlaneOnly(plane) {
    if (plane !== SOCIAL_CONNECTIONS_PLANE) {
      throw new Error(
        `connected accounts use only ${SOCIAL_CONNECTIONS_PLANE}; refused ${plane}`
      )
    }
  }

  connect({
    providerId,
    accountLabel,
    accessToken,
    refreshToken = null,
    scopes,
    expiresAt = null,
  }) {
    this.assertSocialPlaneOnly(SOCIAL_CONNECTIONS_PLANE)
    const provider = getProvider(providerId, this._registry)
    if (provider.verification !== "policy_verified") {
      throw new Error(`${providerId}: cannot connect unverified provider`)
    }
    const resolvedScopes =
      scopes ?? [...(provider.oauth_scopes_least_privilege ?? [])]
    assertLeastPrivilegeScopes(providerId, resolvedScopes, this._registry)
    if (typeof accountLabel !== "string" || !accountLabel.trim()) {
      throw new Error("account_label required")
    }
    if (typeof accessToken !== "string" || !accessToken) {
      throw new Error("access_token required")
    }
    this._seq += 1
    const connectionId = `social-conn-${providerId}-${this._seq}`
    this.socialStore.put(connectionId, {
      access_token: accessToken,
      refresh_token: refreshToken,
      scopes: resolvedScopes,
      expires_at: expiresAt,
    })
    const row = {
      connection_id: connectionId,
      provider_id: provider.id,
      provider_display_name: provider.display_name,
      account_label: accountLabel.trim(),
      capabilities: capabilitiesFor(provider),
      status: statusFor(provider, true),
      revoke_available: true,
      plane: SOCIAL_CONNECTIONS_PLANE,
      updated_at: this._clockIso(),
    }
    this._meta.set(connectionId, row)
    return { ...row }
  }

  listConnections() {
    return [...this._meta.values()]
      .filter((row) => this.socialStore.has(row.connection_id))
      .map((row) => {
        const provider = getProvider(row.provider_id, this._registry)
        return {
          ...row,
          capabilities: capabilitiesFor(provider),
          status: statusFor(provider, true),
          revoke_available: true,
        }
      })
  }

  /**
   * Safe UI row; never includes token ciphertext or plaintext.
   */
  describe(connectionId) {
    const row = this._meta.get(connectionId)
    if (!row || !this.socialStore.has(connectionId)) {
      return null
    }
    const provider = getProvider(row.provider_id, this._registry)
    const tokenMeta = this.socialStore.describe(connectionId)
    return {
      connection_id: connectionId,
      provider_id: row.provider_id,
      provider_display_name: row.provider_display_name,
      account_label: row.account_label,
      capabilities: capabilitiesFor(provider),
      status: statusFor(provider, true),
      revoke_available: true,
      plane: SOCIAL_CONNECTIONS_PLANE,
      token_encrypted: tokenMeta?.encrypted === true,
      updated_at: row.updated_at,
    }
  }

  revoke(connectionId) {
    if (!connectionId || !this._meta.has(connectionId)) {
      return { ok: false, message: `unknown connection: ${connectionId}` }
    }
    this.socialStore.revoke(connectionId)
    this._meta.delete(connectionId)
    return {
      ok: true,
      message: `revoked ${connectionId}`,
      connection_id: connectionId,
      status: "not_connected",
    }
  }

  /** Cross-plane probe for AC-11.1 tests; social tokens must not appear elsewhere. */
  otherPlanesLack(connectionId) {
    for (const plane of CREDENTIAL_PLANES) {
      if (plane === SOCIAL_CONNECTIONS_PLANE) {
        continue
      }
      if (this._stores.storeFor(plane).has(connectionId)) {
        return false
      }
    }
    return true
  }
}

export {
  CREDENTIAL_PLANES,
  CredentialStoreRegistry,
  SOCIAL_CONNECTIONS_PLANE,
}
