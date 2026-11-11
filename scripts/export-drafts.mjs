import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DraftStore } from "../src/drafts.mjs"
import { buildExportBundle, writeExportBundle } from "../src/export.mjs"

const selfCheck = process.argv.includes("--self-check")
const outArg = process.argv.slice(2).find((arg) => !arg.startsWith("--"))
const outDir = outArg ?? join("dist", "social-export-demo")

const store = new DraftStore({ clockIso: () => "2026-11-11T00:00:00.000Z" })
store.createDraft({
  kind: "announcement",
  aspect: "1:1",
  bindings: {
    headline: "Matchday tonight",
    body: "Doors open at 18:00. Local draft only.",
  },
})
store.createDraft({
  kind: "score",
  aspect: "16:9",
  bindings: {
    matchup: "Harbor Foxes vs River Cats",
    scoreline: "42-38 Q3",
  },
})

const bundle = buildExportBundle(store.listDrafts(), {
  exportedAt: "2026-11-11T00:01:00.000Z",
})

if (selfCheck) {
  const tmp = mkdtempSync(join(tmpdir(), "om-social-export-"))
  try {
    writeExportBundle(tmp, bundle)
    console.log(`EXPORT_CLI_OK drafts=${bundle.drafts.length} dir=${tmp}`)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
} else {
  mkdirSync(outDir, { recursive: true })
  const { written } = writeExportBundle(outDir, bundle)
  writeFileSync(join(outDir, "README.txt"), "Offline social export. No account.\n", "utf8")
  console.log(`EXPORT_CLI_OK drafts=${bundle.drafts.length} files=${written.length} dir=${outDir}`)
}
