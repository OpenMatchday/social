import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto"

const VERSION = 1
const ALGORITHM = "aes-256-gcm"
const KEY_LEN = 32
const IV_LEN = 12
const SALT_LEN = 16
const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1

/**
 * Encrypted-at-rest OAuth token store (AC-11.5).
 * AES-256-GCM + scrypt key derivation via Node.js crypto
 * https://nodejs.org/api/crypto.html
 * Never logs plaintext tokens.
 */
export class EncryptedTokenStore {
  constructor({ passphrase, clockIso } = {}) {
    if (typeof passphrase !== "string" || passphrase.length < 16) {
      throw new Error("token store passphrase must be at least 16 characters")
    }
    this._passphrase = passphrase
    this._clockIso = clockIso ?? (() => new Date().toISOString())
    this._rows = new Map()
  }

  put(connectionId, tokenRecord) {
    if (!connectionId || typeof connectionId !== "string") {
      throw new Error("connectionId required")
    }
    if (!tokenRecord || typeof tokenRecord !== "object") {
      throw new Error("tokenRecord required")
    }
    if (typeof tokenRecord.access_token !== "string" || !tokenRecord.access_token) {
      throw new Error("access_token required")
    }
    if (!Array.isArray(tokenRecord.scopes) || tokenRecord.scopes.length === 0) {
      throw new Error("scopes required")
    }
    const plaintext = Buffer.from(
      JSON.stringify({
        access_token: tokenRecord.access_token,
        refresh_token: tokenRecord.refresh_token ?? null,
        scopes: tokenRecord.scopes,
        expires_at: tokenRecord.expires_at ?? null,
        token_type: tokenRecord.token_type ?? "Bearer",
      }),
      "utf8"
    )
    const salt = randomBytes(SALT_LEN)
    const key = scryptSync(this._passphrase, salt, KEY_LEN, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
    })
    const iv = randomBytes(IV_LEN)
    const cipher = createCipheriv(ALGORITHM, key, iv)
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
    const tag = cipher.getAuthTag()
    const envelope = {
      v: VERSION,
      alg: ALGORITHM,
      salt: salt.toString("base64"),
      iv: iv.toString("base64"),
      tag: tag.toString("base64"),
      ciphertext: ciphertext.toString("base64"),
      updated_at: this._clockIso(),
    }
    this._rows.set(connectionId, envelope)
    return { connection_id: connectionId, encrypted: true, updated_at: envelope.updated_at }
  }

  has(connectionId) {
    return this._rows.has(connectionId)
  }

  revoke(connectionId) {
    return this._rows.delete(connectionId)
  }

  /**
   * Decrypt for publish only. Caller must not log the return value.
   */
  unlock(connectionId) {
    const envelope = this._rows.get(connectionId)
    if (!envelope) {
      throw new Error(`no encrypted token for connection: ${connectionId}`)
    }
    if (envelope.v !== VERSION || envelope.alg !== ALGORITHM) {
      throw new Error("unsupported token envelope")
    }
    const salt = Buffer.from(envelope.salt, "base64")
    const key = scryptSync(this._passphrase, salt, KEY_LEN, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
    })
    const iv = Buffer.from(envelope.iv, "base64")
    const tag = Buffer.from(envelope.tag, "base64")
    const ciphertext = Buffer.from(envelope.ciphertext, "base64")
    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    return JSON.parse(plaintext.toString("utf8"))
  }

  /** Safe metadata for UI / CI; never includes token material. */
  describe(connectionId) {
    const envelope = this._rows.get(connectionId)
    if (!envelope) {
      return null
    }
    return {
      connection_id: connectionId,
      encrypted: true,
      alg: envelope.alg,
      updated_at: envelope.updated_at,
    }
  }

  exportEnvelopes() {
    return Object.fromEntries(this._rows.entries())
  }

  importEnvelopes(map) {
    for (const [connectionId, envelope] of Object.entries(map ?? {})) {
      this._rows.set(connectionId, envelope)
    }
  }
}

export const envelopesEqual = (a, b) => {
  const left = Buffer.from(JSON.stringify(a))
  const right = Buffer.from(JSON.stringify(b))
  if (left.length !== right.length) {
    return false
  }
  return timingSafeEqual(left, right)
}
