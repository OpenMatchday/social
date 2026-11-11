import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { BANNED_ENGAGEMENT_FIELDS, collectBannedKeys } from "../src/banned-metrics.mjs"
import { SOCIAL_TEMPLATE_KINDS, loadShippedTemplates } from "../src/templates.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const contractPath = join(root, "contracts", "social-export.v0.json")
const contract = JSON.parse(readFileSync(contractPath, "utf8"))

if (contract.contract_id !== "open-matchday.social-export") {
  console.error("bad contract_id")
  process.exit(1)
}

if (contract.contract_version !== "0.1.0") {
  console.error("unexpected contract_version")
  process.exit(1)
}

const templates = loadShippedTemplates()
const kinds = new Set(templates.map((t) => t.kind))

for (const kind of SOCIAL_TEMPLATE_KINDS) {
  if (!kinds.has(kind)) {
    console.error(`missing template kind ${kind}`)
    process.exit(1)
  }
}

if (templates.length !== SOCIAL_TEMPLATE_KINDS.length) {
  console.error(`expected ${SOCIAL_TEMPLATE_KINDS.length} templates, got ${templates.length}`)
  process.exit(1)
}

for (const template of templates) {
  const hits = collectBannedKeys(template)
  if (hits.length > 0) {
    console.error(`${template.template_id}: banned fields ${hits.join(", ")}`)
    process.exit(1)
  }
  if (template.graphics_kind !== contract.graphics_kind) {
    console.error(`${template.template_id}: graphics_kind mismatch`)
    process.exit(1)
  }
  for (const aspect of template.aspects) {
    if (!contract.supported_aspects.includes(aspect)) {
      console.error(`${template.template_id}: unsupported aspect ${aspect}`)
      process.exit(1)
    }
  }
}

for (const field of BANNED_ENGAGEMENT_FIELDS) {
  if (!contract.banned_fields.includes(field)) {
    console.error(`contract missing banned field ${field}`)
    process.exit(1)
  }
}

console.log(
  `TEMPLATE_CHECK_OK templates=${templates.length} kinds=${[...kinds].sort().join(",")}`
)
