const targetUrl = process.env.HEALTHCHECK_URL

if (!targetUrl) {
  console.error('HEALTHCHECK_URL is required for http-healthcheck')
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
