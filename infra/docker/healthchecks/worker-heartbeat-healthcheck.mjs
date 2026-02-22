import { readFile } from 'node:fs/promises'

const heartbeatFile = process.env.WORKER_HEALTHCHECK_FILE ?? '/tmp/worker-heartbeat'
const maxAgeRaw = process.env.WORKER_HEALTHCHECK_MAX_AGE_MS ?? '120000'
const maxAgeMs = Number(maxAgeRaw)

if (!Number.isFinite(maxAgeMs) || maxAgeMs <= 0) {
  console.error(
    `WORKER_HEALTHCHECK_MAX_AGE_MS must be a positive number, received "${maxAgeRaw}"`
  )
  process.exit(1)
}

try {
  const raw = await readFile(heartbeatFile, 'utf8')
  const timestamp = Number(raw.trim())

  if (!Number.isFinite(timestamp)) {
    console.error(`Heartbeat file ${heartbeatFile} does not contain a valid timestamp`)
    process.exit(1)
  }

  const ageMs = Date.now() - timestamp

  if (ageMs > maxAgeMs) {
    console.error(`Heartbeat file ${heartbeatFile} is stale (${ageMs}ms > ${maxAgeMs}ms)`)
    process.exit(1)
  }

  process.exit(0)
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Unable to read heartbeat file ${heartbeatFile}: ${message}`)
  process.exit(1)
}
