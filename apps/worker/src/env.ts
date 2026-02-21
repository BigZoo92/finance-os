import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import { z } from 'zod'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

config({
  path: resolve(__dirname, '../../../.env'),
  override: true,
})

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  WORKER_HEARTBEAT_MS: z.coerce.number().int().positive().default(30000),
})

const parsed = EnvSchema.safeParse(process.env)

if (!parsed.success) {
  throw new Error(
    `Invalid worker environment variables:\n${JSON.stringify(
      parsed.error.flatten().fieldErrors,
      null,
      2
    )}`
  )
}

export const env = parsed.data
