import {
  assertPasswordProvided,
  encodeAuthPasswordHashB64,
  generatePasswordHash,
  readPasswordInput,
} from './hash-password-utils'

const main = async () => {
  const password = await readPasswordInput()
  assertPasswordProvided(password)

  const hash = await generatePasswordHash(password)
  const hashB64 = encodeAuthPasswordHashB64(hash)

  console.log(`AUTH_ADMIN_PASSWORD_HASH=${hash}`)
  console.log(`AUTH_ADMIN_PASSWORD_HASH_B64=${hashB64}`)
  console.log(`AUTH_PASSWORD_HASH=${hash}`)
  console.log(`AUTH_PASSWORD_HASH_B64=${hashB64}`)
}

void main().catch(error => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`auth:hash-b64 failed: ${message}`)
  process.exit(1)
})
