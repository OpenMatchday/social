import { readFileSync, readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const templatesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "templates")

export const SOCIAL_TEMPLATE_KINDS = Object.freeze([
  "announcement",
  "lineup",
  "score",
  "result",
  "clip",
])

export const loadShippedTemplates = () => {
  const names = readdirSync(templatesDir)
    .filter((name) => name.endsWith(".json"))
    .sort()
  return names.map((name) =>
    JSON.parse(readFileSync(join(templatesDir, name), "utf8"))
  )
}

export const loadTemplateByKind = (kind) => {
  const found = loadShippedTemplates().find((template) => template.kind === kind)
  if (!found) {
    throw new Error(`no social template for kind ${kind}`)
  }
  return found
}

export const loadTemplateById = (templateId) => {
  const found = loadShippedTemplates().find(
    (template) => template.template_id === templateId
  )
  if (!found) {
    throw new Error(`no social template id ${templateId}`)
  }
  return found
}
