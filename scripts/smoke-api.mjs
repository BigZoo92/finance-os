#!/usr/bin/env node

const args = process.argv.slice(2)

const getArg = (name, fallback) => {
  const withEquals = args.find(arg => arg.startsWith(`${name}=`))
  if (withEquals) {
    return withEquals.slice(name.length + 1)
  }

  const index = args.findIndex(arg => arg === name)
  if (index >= 0) {
    return args[index + 1] ?? fallback
  }

  return fallback
}

const baseUrl = (getArg('--base', process.env.API_BASE_URL ?? 'http://127.0.0.1:3001') || '')
  .trim()
  .replace(/\/+$/, '')
const debugToken = getArg('--debug-token', process.env.DEBUG_METRICS_TOKEN ?? '').trim()
const internalToken = getArg('--internal-token', process.env.PRIVATE_ACCESS_TOKEN ?? '').trim()

const runCheck = async ({ name, path, expectedStatuses, headers = {} }) => {
  const url = `${baseUrl}${path}`
  const response = await fetch(url, {
    method: 'GET',
    headers,
  })
  const text = await response.text()
  const bodyPreview = text.trim().slice(0, 250)
  const ok = expectedStatuses.includes(response.status)

  console.log(
    JSON.stringify({
      name,
      url,
      status: response.status,
      expectedStatuses,
      ok,
      bodyPreview,
    })
  )

  if (!ok) {
    process.exitCode = 1
  }
}

const main = async () => {
  await runCheck({
    name: 'health',
    path: '/health',
    expectedStatuses: [200],
  })

  await runCheck({
    name: 'auth_me_without_cookie',
    path: '/auth/me',
    expectedStatuses: [401],
  })

  if (debugToken) {
    await runCheck({
      name: 'debug_routes_with_debug_token',
      path: '/debug/routes',
      expectedStatuses: [200],
      headers: {
        'x-finance-os-debug-token': debugToken,
      },
    })
  } else if (internalToken) {
    await runCheck({
      name: 'debug_routes_with_internal_token',
      path: '/debug/routes',
      expectedStatuses: [200],
      headers: {
        'x-internal-token': internalToken,
      },
    })
  } else {
    console.log(
      JSON.stringify({
        name: 'debug_routes_skipped',
        reason: 'no --debug-token or --internal-token provided',
      })
    )
  }
}

await main()
