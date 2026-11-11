import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  SOCIAL_TEMPLATE_KINDS,
  loadShippedTemplates,
  loadTemplateByKind,
} from "../src/templates.mjs"

describe("social templates (AC-11.3)", () => {
  it("ships announcement, lineup, score, result, and clip", () => {
    const templates = loadShippedTemplates()
    assert.equal(templates.length, 5)
    assert.deepEqual(
      templates.map((t) => t.kind).sort(),
      [...SOCIAL_TEMPLATE_KINDS].sort()
    )
  })

  it("maps every template to graphics social_cards", () => {
    for (const kind of SOCIAL_TEMPLATE_KINDS) {
      const template = loadTemplateByKind(kind)
      assert.equal(template.graphics_kind, "social_cards")
      assert.ok(template.card_map.title)
      assert.ok(template.card_map.subtitle)
      assert.ok(template.aspects.includes("1:1"))
    }
  })
})
