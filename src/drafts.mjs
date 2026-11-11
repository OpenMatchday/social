import { assertNoFakeMetrics } from "./banned-metrics.mjs"
import { loadTemplateById, loadTemplateByKind } from "./templates.mjs"

const ASPECTS = new Set(["16:9", "9:16", "1:1"])

const fillCaption = (template, bindings) => {
  let text = template.caption_template ?? ""
  for (const slot of template.slots) {
    const value = bindings[slot.slot_id] ?? ""
    text = text.split(`{{${slot.slot_id}}}`).join(value)
  }
  return text.replace(/\n{3,}/g, "\n\n").trim()
}

const cardBindings = (template, bindings) => {
  const mapped = {}
  for (const [cardSlot, sourceSlot] of Object.entries(template.card_map ?? {})) {
    mapped[cardSlot] = bindings[sourceSlot] ?? ""
  }
  return mapped
}

const validateBindings = (template, bindings) => {
  if (!bindings || typeof bindings !== "object" || Array.isArray(bindings)) {
    throw new Error("bindings must be an object")
  }
  assertNoFakeMetrics(bindings, "bindings")
  for (const slot of template.slots) {
    const value = bindings[slot.slot_id]
    if (slot.required && (value === undefined || value === null || value === "")) {
      throw new Error(`slot ${slot.slot_id} is required`)
    }
    if (value !== undefined && value !== null && typeof value !== "string") {
      throw new Error(`slot ${slot.slot_id} must be a string`)
    }
    if (typeof value === "string" && value.length > slot.max_length) {
      throw new Error(`slot ${slot.slot_id} exceeds max_length ${slot.max_length}`)
    }
  }
  for (const key of Object.keys(bindings)) {
    if (!template.slots.some((slot) => slot.slot_id === key)) {
      throw new Error(`unknown slot ${key}`)
    }
  }
}

/**
 * Offline social draft store. No account, network, or engagement metrics (AC-11.4, AC-11.7).
 */
export class DraftStore {
  constructor({ clockIso } = {}) {
    this._clockIso = clockIso ?? (() => new Date().toISOString())
    this._drafts = new Map()
    this._seq = 0
  }

  listTemplates() {
    return ["announcement", "lineup", "score", "result", "clip"].map((kind) =>
      loadTemplateByKind(kind)
    )
  }

  listDrafts() {
    return [...this._drafts.values()]
  }

  getDraft(draftId) {
    const draft = this._drafts.get(draftId)
    if (!draft) {
      throw new Error(`draft not found: ${draftId}`)
    }
    return draft
  }

  createDraft({ templateId, kind, bindings = {}, aspect = "1:1" } = {}) {
    const template = templateId
      ? loadTemplateById(templateId)
      : loadTemplateByKind(kind)
    if (!ASPECTS.has(aspect)) {
      throw new Error(`unsupported aspect ${aspect}`)
    }
    if (!template.aspects.includes(aspect)) {
      throw new Error(`template ${template.template_id} does not support ${aspect}`)
    }
    validateBindings(template, bindings)
    this._seq += 1
    const now = this._clockIso()
    const draft = {
      draft_id: `draft-${this._seq}`,
      template_id: template.template_id,
      kind: template.kind,
      aspect,
      bindings: { ...bindings },
      caption: fillCaption(template, bindings),
      card_bindings: cardBindings(template, bindings),
      graphics_kind: template.graphics_kind,
      account_required: false,
      created_at: now,
      updated_at: now,
    }
    assertNoFakeMetrics(draft, "draft")
    this._drafts.set(draft.draft_id, draft)
    return draft
  }

  updateDraft(draftId, { bindings, aspect } = {}) {
    const existing = this.getDraft(draftId)
    const template = loadTemplateById(existing.template_id)
    const nextBindings = bindings ?? existing.bindings
    const nextAspect = aspect ?? existing.aspect
    if (!ASPECTS.has(nextAspect)) {
      throw new Error(`unsupported aspect ${nextAspect}`)
    }
    validateBindings(template, nextBindings)
    const updated = {
      ...existing,
      aspect: nextAspect,
      bindings: { ...nextBindings },
      caption: fillCaption(template, nextBindings),
      card_bindings: cardBindings(template, nextBindings),
      updated_at: this._clockIso(),
    }
    assertNoFakeMetrics(updated, "draft")
    this._drafts.set(draftId, updated)
    return updated
  }
}
