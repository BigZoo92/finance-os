import { stdin as input, stdout as output } from 'node:process'
import { createInterface } from 'node:readline/promises'
import { pbkdf2Sync, randomBytes } from 'node:crypto'

const PASSWORD_MISSING_MESSAGE = [
  'No password provided.',
  'Use one of:',
  '- pnpm auth:hash -- "my-password"',
  '- echo -n "my-password" | pnpm auth:hash',
].join('\n')

const readPasswordFromStdin = async () => {
  input.setEncoding('utf8')
  let data = ''
  for await (const chunk of input) {
    data += chunk
  }

  return data.trimEnd()
}

const readPasswordFromPrompt = async () => {
  const rl = createInterface({
    input,
    output,
  })

  try {
    const value = await rl.question('Password: ')
    return value.trimEnd()
  } finally {
    rl.close()
  }
}

export const readPasswordInput = async () => {
  const fromArg = process.argv[2]
  if (fromArg) {
    return fromArg
  }

  if (!input.isTTY) {
    return readPasswordFromStdin()
  }

  return readPasswordFromPrompt()
}

export const assertPasswordProvided = (password: string) => {
  if (!password) {
    throw new Error(PASSWORD_MISSING_MESSAGE)
  }
}

const PBKDF2_ITERATIONS = 210_000
const PBKDF2_KEY_LENGTH = 32
const PBKDF2_ALGORITHM = 'sha256'

export const generatePasswordHash = async (password: string) => {
  const salt = randomBytes(16)
  const derivedKey = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEY_LENGTH, PBKDF2_ALGORITHM)
  return `pbkdf2$${PBKDF2_ALGORITHM}$${PBKDF2_ITERATIONS}$${salt.toString('base64url')}$${derivedKey.toString('base64url')}`
}

export const encodeAuthPasswordHashB64 = (hash: string) => {
  return Buffer.from(hash, 'utf8').toString('base64')
}
