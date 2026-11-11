import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, it } from "node:test"
import { assertNoFakeMetrics, collectBannedKeys } from "../src/banned-metrics.mjs"
import { DraftStore } from "../src/drafts.mjs"
import { buildExportBundle, writeExportBundle } from "../src/export.mjs"

describe("drafts and local export (AC-11.4)", () => {
  it("creates drafts without any account", () => {
    const store = new DraftStore({ clockIso: () => "2026-11-11T09:00:00.000Z" })
    const draft = store.createDraft({
      kind: "result",
      bindings: {
        matchup: "Foxes vs Cats",
        final_score: "78-71",
        note: "Harbor fiction fixture",
      },
    })
    assert.equal(draft.account_required, false)
    assert.equal(draft.kind, "result")
    assert.match(draft.caption, /Final/)
    assert.equal(draft.card_bindings.title, "Foxes vs Cats")
  })

  it("exports offline bundle with account null", () => {
    const store = new DraftStore({ clockIso: () => "2026-11-11T09:00:00.000Z" })
    store.createDraft({
      kind: "lineup",
      bindings: {
        team_name: "Harbor Foxes",
        starters: "7 Rivera, 11 Cole, 21 Moss",
      },
    })
    store.createDraft({
      kind: "clip",
      bindings: {
        clip_title: "Fourth-quarter steal",
        timecode: "00:38:12",
        local_media_path: "C:/local/clip.mp4",
      },
    })
    const bundle = buildExportBundle(store.listDrafts(), {
      exportedAt: "2026-11-11T09:05:00.000Z",
    })
    assert.equal(bundle.account, null)
    assert.equal(bundle.drafts.length, 2)
    assert.ok(bundle.drafts.every((d) => d.account_required === false))

    const dir = mkdtempSync(join(tmpdir(), "om-social-"))
    try {
      const { bundlePath, written } = writeExportBundle(dir, bundle)
      assert.ok(written.length >= 1 + bundle.drafts.length * 2)
      const loaded = JSON.parse(readFileSync(bundlePath, "utf8"))
      assert.equal(loaded.account, null)
      assert.equal(collectBannedKeys(loaded).length, 0)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe("no fake engagement metrics (AC-11.7)", () => {
  it("rejects banned fields on create", () => {
    const store = new DraftStore({ clockIso: () => "2026-11-11T09:00:00.000Z" })
    assert.throws(
      () =>
        store.createDraft({
          kind: "announcement",
          bindings: {
            headline: "Hi",
            body: "There",
            likes: "999",
          },
        }),
      /unknown slot likes|banned engagement/
    )
  })

  it("rejects metrics injected into export payload", () => {
    assert.throws(
      () =>
        assertNoFakeMetrics({
          draft_id: "x",
          engagement_rate: 0.42,
        }),
      /banned engagement fields/
    )
  })
})
