export type PasswordVerifyFn = (password: string, hash: string) => Promise<boolean>

const defaultVerifyPassword: PasswordVerifyFn = async (password, hash) => {
  return Bun.password.verify(password, hash)
}

export const normalizeEmail = (value: string) => value.trim().toLowerCase()

export const verifyPasswordHash = async ({
  password,
  passwordHash,
  verifyPassword = defaultVerifyPassword,
}: {
  password: string
  passwordHash: string
  verifyPassword?: PasswordVerifyFn
}) => {
  try {
    return await verifyPassword(password, passwordHash)
  } catch (error) {
    throw new Error(
      `Password verification failed: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}
