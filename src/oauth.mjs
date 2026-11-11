import { getProvider } from "./registry.mjs"

/**
 * Least-privilege OAuth scope gate (AC-11.5).
 * Only scopes listed on the D8 registry row may be requested or used.
 * Sources: provider policy URLs on providers/registry.json; Google OAuth scope
 * guidance https://developers.google.com/youtube/v3/guides/auth/installed-apps
 */
export const assertLeastPrivilegeScopes = (providerId, requestedScopes, registry) => {
  const provider = getProvider(providerId, registry)
  if (provider.verification !== "policy_verified") {
    throw new Error(`${providerId}: publishing requires policy_verified`)
  }
  const allowed = new Set(provider.oauth_scopes_least_privilege ?? [])
  if (!Array.isArray(requestedScopes) || requestedScopes.length === 0) {
    throw new Error(`${providerId}: OAuth scopes required`)
  }
  const extra = requestedScopes.filter((scope) => !allowed.has(scope))
  if (extra.length > 0) {
    throw new Error(
      `${providerId}: scopes exceed least privilege: ${extra.join(", ")}`
    )
  }
  return [...requestedScopes]
}

export const defaultScopesFor = (providerId, registry) => {
  const provider = getProvider(providerId, registry)
  if (provider.verification !== "policy_verified") {
    throw new Error(`${providerId}: no scopes for unverified provider`)
  }
  return [...provider.oauth_scopes_least_privilege]
}
