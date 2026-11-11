import {
  CREDENTIAL_PLANES,
  SOCIAL_CONNECTIONS_PLANE,
  loadConnectedAccountsContract,
} from "../src/connected-accounts.mjs"
import { listPolicyVerifiedProviders, loadProviderRegistry } from "../src/registry.mjs"

const contract = loadConnectedAccountsContract()
if (contract.contract_id !== "open-matchday.connected-accounts") {
  console.error("connected-accounts contract id mismatch")
  process.exit(1)
}
if (contract.contract_version !== "0.1.0") {
  console.error("connected-accounts contract version mismatch")
  process.exit(1)
}
if (
  !Array.isArray(contract.credential_planes) ||
  contract.credential_planes.length !== CREDENTIAL_PLANES.length
) {
  console.error("credential_planes must list all four AC-11.1 planes")
  process.exit(1)
}
for (const plane of CREDENTIAL_PLANES) {
  if (!contract.credential_planes.includes(plane)) {
    console.error(`contract missing credential plane ${plane}`)
    process.exit(1)
  }
}
if (!contract.credential_planes.includes(SOCIAL_CONNECTIONS_PLANE)) {
  console.error("social_connections plane required")
  process.exit(1)
}
for (const field of [
  "connection_id",
  "provider_id",
  "provider_display_name",
  "account_label",
  "capabilities",
  "status",
  "revoke_available",
]) {
  if (!contract.connection_row_required.includes(field)) {
    console.error(`connection row missing required field ${field}`)
    process.exit(1)
  }
}

const registry = loadProviderRegistry()
const verified = listPolicyVerifiedProviders(registry)
if (verified.length < 1) {
  console.error("expected policy_verified providers for connected accounts")
  process.exit(1)
}

console.log(
  `CONNECTED_ACCOUNTS_CHECK_OK planes=${CREDENTIAL_PLANES.length} social_plane=${SOCIAL_CONNECTIONS_PLANE} contract=${contract.contract_version} policy_verified=${verified.length}`
)
