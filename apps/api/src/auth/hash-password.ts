import { assertPasswordProvided, generatePasswordHash, readPasswordInput } from './hash-password-utils'

const main = async () => {
  const password = await readPasswordInput()
  assertPasswordProvided(password)

  const hash = await generatePasswordHash(password)
  console.log(hash)
}

void main().catch(error => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`auth:hash failed: ${message}`)
  process.exit(1)
})
