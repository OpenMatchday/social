import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const registryPath = join(root, "providers", "registry.json")

const allowedVerification = new Set(["policy_verified", "unverified", "rejected"])

const registry = JSON.parse(readFileSync(registryPath, "utf8"))

if (registry.schema_version !== 1) {
  console.error(`unexpected schema_version: ${registry.schema_version}`)
  process.exit(1)
}

if (!Array.isArray(registry.providers) || registry.providers.length === 0) {
  console.error("providers must be a non-empty array")
  process.exit(1)
}

const ids = new Set()
let verifiedCount = 0
let enabledCount = 0

for (const provider of registry.providers) {
  if (!provider.id || typeof provider.id !== "string") {
    console.error("provider missing id")
    process.exit(1)
  }
  if (ids.has(provider.id)) {
    console.error(`duplicate provider id: ${provider.id}`)
    process.exit(1)
  }
  ids.add(provider.id)

  if (!allowedVerification.has(provider.verification)) {
    console.error(`${provider.id}: bad verification ${provider.verification}`)
    process.exit(1)
  }

  if (typeof provider.runtime_enabled !== "boolean") {
    console.error(`${provider.id}: runtime_enabled must be boolean`)
    process.exit(1)
  }

  if (provider.runtime_enabled === true) {
    enabledCount += 1
    if (provider.verification !== "policy_verified") {
      console.error(`${provider.id}: runtime_enabled requires policy_verified`)
      process.exit(1)
    }
  }

  if (provider.verification === "unverified") {
    if (provider.runtime_enabled !== false) {
      console.error(`${provider.id}: unverified providers must stay disabled`)
      process.exit(1)
    }
    if (Array.isArray(provider.policy_urls) && provider.policy_urls.length > 0) {
      console.error(`${provider.id}: unverified entries must not claim policy_urls`)
      process.exit(1)
    }
  }

  if (provider.verification === "policy_verified") {
    verifiedCount += 1
    if (!Array.isArray(provider.policy_urls) || provider.policy_urls.length === 0) {
      console.error(`${provider.id}: policy_verified requires policy_urls`)
      process.exit(1)
    }
    for (const url of provider.policy_urls) {
      if (typeof url !== "string" || !/^https:\/\//.test(url)) {
        console.error(`${provider.id}: policy URL must be https: ${url}`)
        process.exit(1)
      }
    }
    if (!Array.isArray(provider.oauth_scopes_least_privilege) || provider.oauth_scopes_least_privilege.length === 0) {
      console.error(`${provider.id}: policy_verified requires oauth_scopes_least_privilege`)
      process.exit(1)
    }
    if (typeof provider.rate_or_quota !== "string" || provider.rate_or_quota.length < 8) {
      console.error(`${provider.id}: policy_verified requires rate_or_quota notes`)
      process.exit(1)
    }
    if (typeof provider.official_api !== "string" || !provider.official_api) {
      console.error(`${provider.id}: policy_verified requires official_api`)
      process.exit(1)
    }
  }
}

if (enabledCount !== 0) {
  console.error(`SPIKE_GUARD: expected zero runtime_enabled providers, found ${enabledCount}`)
  process.exit(1)
}

console.log(
  `PROVIDER_CHECK_OK providers=${registry.providers.length} policy_verified=${verifiedCount} runtime_enabled=${enabledCount}`,
)
