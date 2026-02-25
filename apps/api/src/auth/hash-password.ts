const readPassword = async () => {
  const fromArg = process.argv[2]
  if (fromArg) return fromArg

  if (!process.stdin.isTTY) {
    process.stdin.setEncoding('utf8')
    let data = ''
    for await (const chunk of process.stdin) data += chunk
    return data.trimEnd()
  }

  throw new Error(
    'No password. Use either:\n- bun src/auth/hash-password.ts "my-password"\n- echo -n "my-password" | bun src/auth/hash-password.ts'
  )
}

const main = async () => {
  const password = await readPassword()
  console.log({ password })

  if (!password) {
    console.error('No password provided via stdin. Example: echo -n "my-password" | pnpm auth:hash')
    process.exit(1)
  }
  console.log('started hash')

  const hash = await Bun.password.hash(password, {
    algorithm: 'argon2id',
  })

  console.log(hash)
}

void main().catch(error => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`auth:hash failed: ${message}`)
  process.exit(1)
})
