import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

export const loadProviderRegistry = () =>
  JSON.parse(readFileSync(join(root, "providers", "registry.json"), "utf8"))

export const getProvider = (providerId, registry = loadProviderRegistry()) => {
  const provider = registry.providers.find((row) => row.id === providerId)
  if (!provider) {
    throw new Error(`unknown provider: ${providerId}`)
  }
  return provider
}

export const listPolicyVerifiedProviders = (registry = loadProviderRegistry()) =>
  registry.providers.filter((row) => row.verification === "policy_verified")
