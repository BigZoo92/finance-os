import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const IV_LENGTH_BYTES = 12
const AUTH_TAG_LENGTH_BYTES = 16
const ENCRYPTION_VERSION = 'v1'

const decodeBase64Key = (value: string) => {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    return null
  }

  const key = Buffer.from(value, 'base64')
  return key.length === 32 ? key : null
}

export const parseEncryptionKey = (rawKey: string) => {
  const trimmed = rawKey.trim()

  if (Buffer.byteLength(trimmed, 'utf8') === 32) {
    return Buffer.from(trimmed, 'utf8')
  }

  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex')
  }

  const base64Key = decodeBase64Key(trimmed)
  if (base64Key) {
    return base64Key
  }

  throw new Error('APP_ENCRYPTION_KEY must resolve to exactly 32 bytes')
}

export const encryptString = (plaintext: string, encryptionKeyRaw: string) => {
  const key = parseEncryptionKey(encryptionKeyRaw)
  const iv = randomBytes(IV_LENGTH_BYTES)
  const cipher = createCipheriv('aes-256-gcm', key, iv)

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return `${ENCRYPTION_VERSION}:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`
}

export const decryptString = (ciphertext: string, encryptionKeyRaw: string) => {
  const [version, ivBase64, authTagBase64, encryptedBase64] = ciphertext.split(':')

  if (version !== ENCRYPTION_VERSION || !ivBase64 || !authTagBase64 || !encryptedBase64) {
    throw new Error('Invalid encrypted payload format')
  }

  const iv = Buffer.from(ivBase64, 'base64')
  const authTag = Buffer.from(authTagBase64, 'base64')
  const encrypted = Buffer.from(encryptedBase64, 'base64')

  if (iv.length !== IV_LENGTH_BYTES || authTag.length !== AUTH_TAG_LENGTH_BYTES) {
    throw new Error('Invalid encrypted payload metadata')
  }

  const key = parseEncryptionKey(encryptionKeyRaw)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return decrypted.toString('utf8')
}
