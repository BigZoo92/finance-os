const DEFAULT_HEALTHCHECK_PATH = '/healthz'
const targetUrlRaw = process.env.HEALTHCHECK_URL
const targetPathRaw = process.env.HEALTHCHECK_PATH

if (!targetUrlRaw) {
  console.error('HEALTHCHECK_URL is required for http-healthcheck')
  process.exit(1)
}

let targetUrl

try {
  const parsed = new URL(targetUrlRaw)
  const currentPath = parsed.pathname
  const hasPath = currentPath && currentPath !== '/'
  const targetPath = targetPathRaw
    ? targetPathRaw.startsWith('/')
      ? targetPathRaw
      : `/${targetPathRaw}`
    : hasPath
      ? currentPath
      : DEFAULT_HEALTHCHECK_PATH

  parsed.pathname = targetPath
  targetUrl = parsed.toString()
} catch {
  console.error(`Invalid HEALTHCHECK_URL value: ${targetUrlRaw}`)
  process.exit(1)
}

try {
  const response = await fetch(targetUrl, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    console.error(`[healthcheck] ${targetUrl} returned ${response.status}`)
    process.exit(1)
  }

  process.exit(0)
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[healthcheck] request failed for ${targetUrl}: ${message}`)
  process.exit(1)
}
