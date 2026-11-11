import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { assertNoFakeMetrics } from "./banned-metrics.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const contractPath = join(root, "contracts", "publish-approval.v0.json")

export const loadPublishApprovalContract = () =>
  JSON.parse(readFileSync(contractPath, "utf8"))

const isIsoTimestamp = (value) =>
  typeof value === "string" &&
  Number.isFinite(Date.parse(value)) &&
  /^\d{4}-\d{2}-\d{2}T/.test(value)

/**
 * Build AC-11.6 approval payload. UI must display account, content, visibility
 * before the operator sets approved=true.
 */
export const buildPublishApproval = ({
  account,
  content,
  visibility,
  approved = false,
  approvedAt,
  clockIso,
} = {}) => {
  const contract = loadPublishApprovalContract()
  const payload = {
    contract_id: contract.contract_id,
    contract_version: contract.contract_version,
    account: {
      provider_id: account?.provider_id,
      account_label: account?.account_label,
      connection_id: account?.connection_id,
    },
    content: {
      draft_id: content?.draft_id,
      kind: content?.kind,
      caption: content?.caption,
      media_refs: content?.media_refs ?? [],
    },
    visibility,
    approved: approved === true,
    approved_at: approved === true ? (approvedAt ?? (clockIso?.() ?? new Date().toISOString())) : null,
  }
  assertNoFakeMetrics(payload, "publish approval")
  return payload
}

export const assertPublishApproved = (approval) => {
  const contract = loadPublishApprovalContract()
  if (!approval || typeof approval !== "object") {
    throw new Error("publish approval required")
  }
  assertNoFakeMetrics(approval, "publish approval")
  if (approval.contract_id !== contract.contract_id) {
    throw new Error(`unexpected approval contract_id: ${approval.contract_id}`)
  }
  if (approval.contract_version !== contract.contract_version) {
    throw new Error(`unexpected approval contract_version: ${approval.contract_version}`)
  }
  for (const key of contract.account_required) {
    if (typeof approval.account?.[key] !== "string" || !approval.account[key]) {
      throw new Error(`approval.account.${key} required`)
    }
  }
  for (const key of contract.content_required) {
    if (typeof approval.content?.[key] !== "string" || !approval.content[key]) {
      throw new Error(`approval.content.${key} required`)
    }
  }
  if (!contract.visibility_values.includes(approval.visibility)) {
    throw new Error(`approval.visibility invalid: ${approval.visibility}`)
  }
  if (approval.approved !== true) {
    throw new Error("publish rejected: explicit approval required (AC-11.6)")
  }
  if (!isIsoTimestamp(approval.approved_at)) {
    throw new Error("approval.approved_at must be ISO-8601 when approved")
  }
  return approval
}
