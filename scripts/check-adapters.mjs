import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { listAdapterProviderIds } from "../src/adapters/catalog.mjs"
import { MOCK_LABEL } from "../src/adapters/mock-transport.mjs"
import { loadPublishApprovalContract } from "../src/approval.mjs"
import { listPolicyVerifiedProviders, loadProviderRegistry } from "../src/registry.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const registry = loadProviderRegistry()
const adapters = new Set(listAdapterProviderIds())
const verified = listPolicyVerifiedProviders(registry)

if (adapters.size !== verified.length) {
  console.error(
    `adapter count ${adapters.size} != policy_verified ${verified.length}`
  )
  process.exit(1)
}

for (const provider of verified) {
  if (!adapters.has(provider.id)) {
    console.error(`missing adapter for policy_verified provider: ${provider.id}`)
    process.exit(1)
  }
  if (provider.runtime_enabled === true) {
    console.error(
      `${provider.id}: runtime_enabled=true requires owner credentials; OM-035 keeps false`
    )
    process.exit(1)
  }
  if (
    !Array.isArray(provider.oauth_scopes_least_privilege) ||
    provider.oauth_scopes_least_privilege.length === 0
  ) {
    console.error(`${provider.id}: missing least-privilege scopes`)
    process.exit(1)
  }
}

for (const id of adapters) {
  const row = registry.providers.find((p) => p.id === id)
  if (!row || row.verification !== "policy_verified") {
    console.error(`adapter ${id} is not policy_verified`)
    process.exit(1)
  }
}

const contract = loadPublishApprovalContract()
if (contract.contract_id !== "open-matchday.publish-approval") {
  console.error("publish approval contract id mismatch")
  process.exit(1)
}
for (const field of ["account", "content", "visibility"]) {
  if (!contract.required_top_level.includes(field)) {
    console.error(`approval contract missing required field ${field}`)
    process.exit(1)
  }
}

const mockFixture = JSON.parse(
  readFileSync(join(root, "mocks", "labeled", "publish-ok.json"), "utf8")
)
if (mockFixture.mock_label !== MOCK_LABEL || mockFixture.live !== false) {
  console.error("labeled mock fixture must set mock_label=MOCK and live=false")
  process.exit(1)
}

const scrapeHits = []
for (const defId of adapters) {
  // Guard: adapters module path names only; scrape keyword ban in catalog source
  void defId
}
const catalogSrc = readFileSync(
  join(root, "src", "adapters", "catalog.mjs"),
  "utf8"
)
if (/\bscrape\b/i.test(catalogSrc)) {
  scrapeHits.push("catalog.mjs")
}
if (scrapeHits.length > 0) {
  console.error(`scrape paths forbidden: ${scrapeHits.join(", ")}`)
  process.exit(1)
}

console.log(
  `ADAPTER_CHECK_OK adapters=${adapters.size} policy_verified=${verified.length} runtime_enabled=0 approval_contract=${contract.contract_version} mock_label=${MOCK_LABEL}`
)
