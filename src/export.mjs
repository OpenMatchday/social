import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { assertNoFakeMetrics } from "./banned-metrics.mjs"

export const EXPORT_FORMAT = "open-matchday.social-export"
export const EXPORT_FORMAT_VERSION = "0.1.0"

/**
 * Build a local export bundle. account is always null (AC-11.4).
 * Never includes engagement metrics (AC-11.7).
 */
export const buildExportBundle = (drafts, { exportedAt } = {}) => {
  if (!Array.isArray(drafts) || drafts.length === 0) {
    throw new Error("export requires at least one draft")
  }
  for (const draft of drafts) {
    assertNoFakeMetrics(draft, `draft ${draft.draft_id}`)
    if (draft.account_required === true) {
      throw new Error(`draft ${draft.draft_id} incorrectly requires an account`)
    }
  }
  const bundle = {
    format: EXPORT_FORMAT,
    format_version: EXPORT_FORMAT_VERSION,
    exported_at: exportedAt ?? new Date().toISOString(),
    account: null,
    graphics_contract: "open-matchday.social-export@0.1.0",
    drafts: drafts.map((draft) => ({
      draft_id: draft.draft_id,
      template_id: draft.template_id,
      kind: draft.kind,
      aspect: draft.aspect,
      bindings: { ...draft.bindings },
      caption: draft.caption,
      card_bindings: { ...draft.card_bindings },
      graphics_kind: draft.graphics_kind,
      account_required: false,
    })),
  }
  assertNoFakeMetrics(bundle, "export bundle")
  return bundle
}

export const writeExportBundle = (dir, bundle) => {
  assertNoFakeMetrics(bundle, "export bundle")
  mkdirSync(dir, { recursive: true })
  const bundlePath = join(dir, "social-export.json")
  writeFileSync(bundlePath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8")
  const written = [bundlePath]
  for (const draft of bundle.drafts) {
    const captionPath = join(dir, `${draft.draft_id}.caption.txt`)
    writeFileSync(captionPath, `${draft.caption}\n`, "utf8")
    written.push(captionPath)
    const cardPath = join(dir, `${draft.draft_id}.card.json`)
    writeFileSync(
      cardPath,
      `${JSON.stringify(
        {
          graphics_kind: draft.graphics_kind,
          aspect: draft.aspect,
          bindings: draft.card_bindings,
        },
        null,
        2
      )}\n`,
      "utf8"
    )
    written.push(cardPath)
  }
  return { bundlePath, written }
}
