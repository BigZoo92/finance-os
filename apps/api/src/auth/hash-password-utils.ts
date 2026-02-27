import { stdin as input, stdout as output } from 'node:process'
import { createInterface } from 'node:readline/promises'

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

export const generateArgon2Hash = async (password: string) => {
  return Bun.password.hash(password, {
    algorithm: 'argon2id',
  })
}

export const encodeAuthPasswordHashB64 = (hash: string) => {
  return Buffer.from(hash, 'utf8').toString('base64')
}
