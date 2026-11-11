import { assertLeastPrivilegeScopes, defaultScopesFor } from "../oauth.mjs"
import { getProvider } from "../registry.mjs"

export const createAdapter = ({
  providerId,
  officialEndpoint,
  buildPublishBody,
}) => {
  const publish = async ({
    approval,
    tokenRecord,
    transport,
    registry,
    mode,
  }) => {
    const provider = getProvider(providerId, registry)
    if (provider.verification !== "policy_verified") {
      throw new Error(`${providerId}: not policy_verified`)
    }
    if (mode === "live" && provider.runtime_enabled !== true) {
      throw new Error(
        `${providerId}: live publish blocked (runtime_enabled=false)`
      )
    }
    const scopes = assertLeastPrivilegeScopes(
      providerId,
      tokenRecord.scopes ?? defaultScopesFor(providerId, registry),
      registry
    )
    const body = buildPublishBody({ approval, scopes, provider })
    const result = await transport.request("publish", {
      provider_id: providerId,
      official_endpoint: officialEndpoint,
      scopes,
      visibility: approval.visibility,
      body,
      // Token material must stay on the wire shape only inside transport;
      // mock transport records presence, never stores plaintext in result.
      has_access_token: typeof tokenRecord.access_token === "string",
    })
    return {
      provider_id: providerId,
      official_api: provider.official_api,
      official_endpoint: officialEndpoint,
      mode,
      scopes_used: scopes,
      result,
    }
  }

  return {
    providerId,
    officialEndpoint,
    publish,
  }
}
