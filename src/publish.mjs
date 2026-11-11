import { assertPublishApproved } from "./approval.mjs"
import { buildAdapterMap } from "./adapters/catalog.mjs"
import {
  assertLabeledMock,
  createLabeledMockTransport,
} from "./adapters/mock-transport.mjs"
import { assertLeastPrivilegeScopes } from "./oauth.mjs"
import { loadProviderRegistry } from "./registry.mjs"

const adapters = buildAdapterMap()

/**
 * Publish orchestrator (AC-11.5, AC-11.6).
 * - Requires explicit approval showing account, content, visibility
 * - Uses encrypted token store unlock
 * - Least-privilege scopes only
 * - Live mode blocked unless registry runtime_enabled=true
 * - Mock mode uses labeled MOCK transport for CI
 */
export const publishDraft = async ({
  approval,
  tokenStore,
  mode = "mock",
  transport,
  registry = loadProviderRegistry(),
} = {}) => {
  if (mode !== "mock" && mode !== "live") {
    throw new Error(`unsupported publish mode: ${mode}`)
  }
  const approved = assertPublishApproved(approval)
  const providerId = approved.account.provider_id
  if (approved.account.provider_id !== providerId) {
    throw new Error("provider mismatch")
  }
  const adapter = adapters.get(providerId)
  if (!adapter) {
    throw new Error(`no official adapter for provider: ${providerId}`)
  }
  const tokenRecord = tokenStore.unlock(approved.account.connection_id)
  assertLeastPrivilegeScopes(providerId, tokenRecord.scopes, registry)

  const activeTransport =
    mode === "mock"
      ? (transport ?? createLabeledMockTransport())
      : transport
  if (mode === "mock") {
    if (!activeTransport || activeTransport.live !== false) {
      throw new Error("mock mode requires non-live labeled transport")
    }
  }
  if (mode === "live") {
    if (!activeTransport || typeof activeTransport.request !== "function") {
      throw new Error("live mode requires an injected transport (no default live client)")
    }
    if (activeTransport.live !== true) {
      throw new Error("live mode transport must declare live=true")
    }
  }

  const outcome = await adapter.publish({
    approval: approved,
    tokenRecord,
    transport: activeTransport,
    registry,
    mode,
  })

  if (mode === "mock") {
    assertLabeledMock(outcome.result)
  }

  // Never return decrypted token material.
  return {
    ok: true,
    mode,
    provider_id: providerId,
    account_label: approved.account.account_label,
    visibility: approved.visibility,
    draft_id: approved.content.draft_id,
    scopes_used: outcome.scopes_used,
    official_api: outcome.official_api,
    official_endpoint: outcome.official_endpoint,
    result: outcome.result,
  }
}

export const listPublishAdapters = () => [...adapters.keys()]
