#!/usr/bin/env node

const args = process.argv.slice(2)

const readArg = (name, fallback) => {
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

const normalizeBaseUrl = value => {
  return (value || '').trim().replace(/\/+$/, '')
}

const baseUrl = normalizeBaseUrl(
  readArg(
    '--base',
    process.env.API_SMOKE_BASE_URL ?? process.env.API_BASE_URL ?? 'http://127.0.0.1:3001'
  )
)

const internalToken = readArg('--internal-token', process.env.PRIVATE_ACCESS_TOKEN ?? '').trim()

if (!baseUrl) {
  console.error('Missing base URL. Use --base=<url> or API_SMOKE_BASE_URL.')
  process.exit(1)
}

const REQUIRED_ROUTES = [
  'GET /health',
  'GET /api/health',
  'GET /version',
  'GET /api/version',
  'GET /auth/me',
  'GET /api/auth/me',
  'POST /integrations/powens/callback',
  'POST /api/integrations/powens/callback',
]

const runCheck = async ({
  name,
  method = 'GET',
  path,
  expectedStatuses,
  headers = {},
  body,
  assert,
}) => {
  const url = `${baseUrl}${path}`
  const response = await fetch(url, {
    method,
    headers,
    ...(typeof body === 'undefined' ? {} : { body }),
  })
  const rawBody = await response.text()
  const bodyPreview = rawBody.trim().slice(0, 300)
  const statusOk = expectedStatuses.includes(response.status)

  let assertOk = true
  let assertMessage = null
  if (typeof assert === 'function') {
    const result = await assert({
      response,
      rawBody,
    })
    if (result !== true) {
      assertOk = false
      assertMessage = typeof result === 'string' ? result : 'custom assertion failed'
    }
  }

  const ok = statusOk && assertOk

  console.log(
    JSON.stringify({
      name,
      method,
      url,
      status: response.status,
      expectedStatuses,
      ok,
      assertMessage,
      requestId: response.headers.get('x-request-id'),
      bodyPreview,
    })
  )

  if (!ok) {
    process.exitCode = 1
  }
}

const asJson = raw => {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const main = async () => {
  await runCheck({
    name: 'health_root',
    path: '/health',
    expectedStatuses: [200],
    assert: ({ rawBody }) => {
      const parsed = asJson(rawBody)
      if (!parsed || typeof parsed !== 'object') {
        return 'health payload is not JSON'
      }

      if (parsed.ok !== true || parsed.service !== 'web') {
        return 'health payload must contain ok=true and service=web'
      }

      return true
    },
  })

  await runCheck({
    name: 'health_api_prefix',
    path: '/api/health',
    expectedStatuses: [200],
    assert: ({ rawBody }) => {
      const parsed = asJson(rawBody)
      if (!parsed || typeof parsed !== 'object') {
        return 'api health payload is not JSON'
      }

      if (parsed.ok !== true || parsed.service !== 'api') {
        return 'api health payload must contain ok=true and service=api'
      }

      return true
    },
  })

  await runCheck({
    name: 'version_root',
    path: '/version',
    expectedStatuses: [200],
    assert: ({ rawBody }) => {
      const parsed = asJson(rawBody)
      if (!parsed || typeof parsed !== 'object') {
        return 'version payload is not JSON'
      }

      if (parsed.service !== 'web') {
        return 'version payload missing service=web'
      }

      if (!('NODE_ENV' in parsed)) {
        return 'version payload missing NODE_ENV'
      }

      return true
    },
  })

  await runCheck({
    name: 'version_api_prefix',
    path: '/api/version',
    expectedStatuses: [200],
    assert: ({ rawBody }) => {
      const parsed = asJson(rawBody)
      if (!parsed || typeof parsed !== 'object') {
        return 'api version payload is not JSON'
      }

      if (parsed.service !== 'api' || !('NODE_ENV' in parsed)) {
        return 'api version payload must contain service=api and NODE_ENV'
      }

      return true
    },
  })

  await runCheck({
    name: 'auth_me_root',
    path: '/auth/me',
    expectedStatuses: [200],
    assert: ({ rawBody }) => {
      const parsed = asJson(rawBody)
      if (!parsed || typeof parsed !== 'object') {
        return 'auth/me payload is not JSON'
      }

      if (!('mode' in parsed)) {
        return 'auth/me payload missing mode'
      }

      return true
    },
  })

  await runCheck({
    name: 'auth_me_api_prefix',
    path: '/api/auth/me',
    expectedStatuses: [200],
  })

  await runCheck({
    name: 'powens_callback_root_exists',
    method: 'POST',
    path: '/integrations/powens/callback',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      connection_id: 'smoke-connection',
      code: 'smoke-code',
    }),
    expectedStatuses: [400, 401, 403, 422, 502],
  })

  await runCheck({
    name: 'powens_callback_api_prefix_exists',
    method: 'POST',
    path: '/api/integrations/powens/callback',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      connection_id: 'smoke-connection',
      code: 'smoke-code',
    }),
    expectedStatuses: [400, 401, 403, 422, 502],
  })

  await runCheck({
    name: '__routes_access',
    path: '/__routes',
    expectedStatuses: internalToken ? [200] : [200, 401, 403],
    headers: internalToken
      ? {
          'x-internal-token': internalToken,
        }
      : {},
    assert: ({ response, rawBody }) => {
      if (response.status !== 200) {
        return true
      }

      const parsed = asJson(rawBody)
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.routes)) {
        return 'invalid /__routes payload'
      }

      const registered = new Set(
        parsed.routes
          .filter(route => route && typeof route === 'object')
          .map(route => `${String(route.method).toUpperCase()} ${String(route.path)}`)
      )
      const missing = REQUIRED_ROUTES.filter(route => !registered.has(route))
      if (missing.length > 0) {
        return `missing required routes: ${missing.join(', ')}`
      }

      return true
    },
  })
}

await main()
