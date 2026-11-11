import { EncryptedTokenStore } from "./tokens.mjs"

/**
 * AC-11.1 credential planes. App sign-in, social connections, stream
 * destinations, and the contribution service keep separate stores and keys.
 * Sources: PROJECT_SPEC AC-11.1; ARCHITECTURE security notes.
 */
export const CREDENTIAL_PLANES = Object.freeze([
  "app_sign_in",
  "social_connections",
  "stream_destinations",
  "contribution_service",
])

export const SOCIAL_CONNECTIONS_PLANE = "social_connections"

const isPlane = (plane) => CREDENTIAL_PLANES.includes(plane)

/**
 * Registry of isolated EncryptedTokenStore instances, one per credential plane.
 * Passphrases must differ per plane so a leaked key cannot unlock another plane.
 */
export class CredentialStoreRegistry {
  constructor({ passphrases, clockIso } = {}) {
    if (!passphrases || typeof passphrases !== "object") {
      throw new Error("passphrases map required for each credential plane")
    }
    this._stores = new Map()
    for (const plane of CREDENTIAL_PLANES) {
      const passphrase = passphrases[plane]
      if (typeof passphrase !== "string" || passphrase.length < 16) {
        throw new Error(`passphrase for plane ${plane} must be at least 16 characters`)
      }
      this._stores.set(
        plane,
        new EncryptedTokenStore({ passphrase, clockIso })
      )
    }
    const unique = new Set(Object.values(passphrases))
    if (unique.size !== CREDENTIAL_PLANES.length) {
      throw new Error("each credential plane must use a distinct passphrase")
    }
  }

  storeFor(plane) {
    if (!isPlane(plane)) {
      throw new Error(`unknown credential plane: ${plane}`)
    }
    return this._stores.get(plane)
  }

  /** True when each plane backs a distinct EncryptedTokenStore instance. */
  planesAreIsolated() {
    const stores = CREDENTIAL_PLANES.map((plane) => this._stores.get(plane))
    return new Set(stores).size === CREDENTIAL_PLANES.length
  }
}
