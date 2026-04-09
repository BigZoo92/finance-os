#!/usr/bin/env node

import { appendFile } from 'node:fs/promises'

const args = process.argv.slice(2)

const readArg = (name, fallback) => {
  const withEquals = args.find(arg => arg.startsWith(`${name}=`))
  if (withEquals) {
    return withEquals.slice(name.length + 1)
  }

  const index = args.indexOf(name)
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
const requestedAuthMode = (readArg('--auth-mode', process.env.SMOKE_AUTH_MODE ?? 'demo') || 'demo')
  .trim()
  .toLowerCase()
const adminEmail = readArg('--admin-email', process.env.SMOKE_ADMIN_EMAIL ?? '').trim()
const adminPassword = readArg('--admin-password', process.env.SMOKE_ADMIN_PASSWORD ?? '')
const sessionCookie = readArg('--session-cookie', process.env.SMOKE_SESSION_COOKIE ?? '').trim()
const summaryRange = (readArg('--summary-range', process.env.SMOKE_SUMMARY_RANGE ?? '30d') || '30d')
  .trim()
  .toLowerCase()
const results = []

const VALID_AUTH_MODES = new Set(['demo', 'admin', 'auto'])
const VALID_SUMMARY_RANGES = new Set(['7d', '30d', '90d'])
const DEMO_CONNECTION_IDS = new Set(['demo-fortuneo', 'demo-revolut'])
const DEMO_ACCOUNT_IDS = new Set([
  'demo-fortuneo-checking',
  'demo-fortuneo-savings',
  'demo-revolut-main',
])
const REQUIRED_ROUTES = [
  'GET /health',
  'GET /api/health',
  'GET /version',
  'GET /api/version',
  'GET /auth/me',
  'GET /api/auth/me',
  'GET /dashboard/summary',
  'GET /api/dashboard/summary',
  'GET /integrations/powens/status',
  'GET /api/integrations/powens/status',
  'POST /integrations/powens/callback',
  'POST /api/integrations/powens/callback',
]

const escapeAnnotationValue = value =>
  String(value ?? '')
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A')

const writeSummary = async lines => {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY
  if (!summaryPath) {
    return
  }

  try {
    const summary = `${lines.join('\n')}\n`
    await appendFile(summaryPath, summary)
  } catch {
    // Summary output is best-effort only.
  }
}

const asJson = raw => {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const isObject = value => typeof value === 'object' && value !== null && !Array.isArray(value)
const isNumber = value => typeof value === 'number' && Number.isFinite(value)
const isStringOrNull = value => typeof value === 'string' || value === null

const createAuthContext = ({ resolvedMode = 'demo', cookieHeader = '' } = {}) => ({
  resolvedMode,
  cookieHeader,
})

const authContext = createAuthContext()

const finalizeFailure = message => {
  console.error(message)
  process.exit(1)
}

if (!baseUrl) {
  finalizeFailure('Missing base URL. Use --base=<url> or API_SMOKE_BASE_URL.')
}

if (!VALID_AUTH_MODES.has(requestedAuthMode)) {
  finalizeFailure(`Invalid auth mode "${requestedAuthMode}". Use demo, admin, or auto.`)
}

if (!VALID_SUMMARY_RANGES.has(summaryRange)) {
  finalizeFailure(`Invalid summary range "${summaryRange}". Use 7d, 30d, or 90d.`)
}

const withAuthHeaders = (headers = {}) => {
  if (!authContext.cookieHeader) {
    return headers
  }

  return {
    ...headers,
    cookie: authContext.cookieHeader,
  }
}

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
  let response
  let rawBody = ''
  let bodyPreview = ''
  let statusOk = false

  try {
    response = await fetch(url, {
      method,
      headers,
      ...(typeof body === 'undefined' ? {} : { body }),
    })
    rawBody = await response.text()
    bodyPreview = rawBody.trim().slice(0, 300)
    statusOk = expectedStatuses.includes(response.status)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    results.push({
      name,
      method,
      url,
      status: 'fetch_error',
      expectedStatuses,
      ok: false,
      assertMessage: message,
      bodyPreview: '',
      requestId: null,
    })
    console.log(
      JSON.stringify({
        name,
        method,
        url,
        status: 'fetch_error',
        expectedStatuses,
        ok: false,
        assertMessage: message,
        requestId: null,
        bodyPreview: '',
      })
    )
    process.exitCode = 1
    return
  }

  let assertOk = true
  let assertMessage = null
  if (typeof assert === 'function') {
    const result = await assert({
      response,
      rawBody,
      path,
    })
    if (result !== true) {
      assertOk = false
      assertMessage = typeof result === 'string' ? result : 'custom assertion failed'
    }
  }

  const ok = statusOk && assertOk
  results.push({
    name,
    method,
    url,
    status: response.status,
    expectedStatuses,
    ok,
    assertMessage,
    bodyPreview,
    requestId: response.headers.get('x-request-id'),
  })

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

const extractSessionCookie = response => {
  const setCookie = response.headers.get('set-cookie')
  if (!setCookie) {
    return null
  }

  const firstCookie = setCookie
    .split(/,(?=[^;]+=[^;]+)/)
    .map(part => part.trim())
    .find(part => part.includes('='))

  if (!firstCookie) {
    return null
  }

  return firstCookie.split(';', 1)[0]?.trim() || null
}

const loginAdminSession = async () => {
  if (sessionCookie) {
    authContext.cookieHeader = sessionCookie
    authContext.resolvedMode = 'admin'
    return
  }

  if (!adminEmail || !adminPassword) {
    finalizeFailure(
      'Admin smoke mode requires --session-cookie or both --admin-email and --admin-password.'
    )
  }

  const url = `${baseUrl}/auth/login`
  let response
  let rawBody = ''

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: adminEmail,
        password: adminPassword,
      }),
    })
    rawBody = await response.text()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    finalizeFailure(`Admin smoke login failed: ${message}`)
  }

  if (response.status !== 200) {
    finalizeFailure(
      `Admin smoke login failed with status ${response.status}. Body preview: ${rawBody
        .trim()
        .slice(0, 200)}`
    )
  }

  const parsed = asJson(rawBody)
  if (!isObject(parsed) || parsed.ok !== true) {
    finalizeFailure('Admin smoke login returned an invalid JSON payload.')
  }

  const cookieHeader = extractSessionCookie(response)
  if (!cookieHeader) {
    finalizeFailure('Admin smoke login did not return a session cookie.')
  }

  authContext.cookieHeader = cookieHeader
  authContext.resolvedMode = 'admin'
}

const resolveExpectedMode = async () => {
  if (requestedAuthMode === 'demo') {
    authContext.resolvedMode = 'demo'
    return
  }

  if (requestedAuthMode === 'admin') {
    await loginAdminSession()
    return
  }

  if (sessionCookie || (adminEmail && adminPassword)) {
    await loginAdminSession()
    return
  }

  authContext.resolvedMode = 'demo'
}

const assertHealthPayload = ({ rawBody, expectedService }) => {
  const parsed = asJson(rawBody)
  if (!isObject(parsed)) {
    return 'payload is not JSON'
  }

  if (parsed.ok !== true || parsed.service !== expectedService) {
    return `payload must contain ok=true and service=${expectedService}`
  }

  return true
}

const assertVersionPayload = ({ rawBody, expectedService }) => {
  const parsed = asJson(rawBody)
  if (!isObject(parsed)) {
    return 'payload is not JSON'
  }

  if (parsed.service !== expectedService) {
    return `payload missing service=${expectedService}`
  }

  if (!('NODE_ENV' in parsed)) {
    return 'payload missing NODE_ENV'
  }

  return true
}

const assertAuthMePayload = ({ rawBody, expectedMode }) => {
  const parsed = asJson(rawBody)
  if (!isObject(parsed)) {
    return 'auth/me payload is not JSON'
  }

  if (parsed.mode !== expectedMode) {
    return `auth/me payload must contain mode=${expectedMode}`
  }

  if (typeof parsed.requestId !== 'string' || parsed.requestId.length === 0) {
    return 'auth/me payload missing requestId'
  }

  if (expectedMode === 'admin') {
    if (!isObject(parsed.user)) {
      return 'admin auth/me payload must contain a user object'
    }

    if (typeof parsed.user.email !== 'string' || typeof parsed.user.displayName !== 'string') {
      return 'admin auth/me user must contain email and displayName'
    }

    return true
  }

  if (parsed.user !== null) {
    return 'demo auth/me payload must contain user=null'
  }

  return true
}

const assertSummaryPayload = ({ rawBody, expectedMode, expectedRange }) => {
  const parsed = asJson(rawBody)
  if (!isObject(parsed)) {
    return 'dashboard summary payload is not JSON'
  }

  if (parsed.range !== expectedRange) {
    return `dashboard summary payload must contain range=${expectedRange}`
  }

  if (!isObject(parsed.totals)) {
    return 'dashboard summary payload missing totals'
  }

  if (!isNumber(parsed.totals.balance) || !isNumber(parsed.totals.incomes) || !isNumber(parsed.totals.expenses)) {
    return 'dashboard summary totals must be finite numbers'
  }

  if (!Array.isArray(parsed.connections) || !Array.isArray(parsed.accounts) || !Array.isArray(parsed.topExpenseGroups)) {
    return 'dashboard summary payload missing array sections'
  }

  const invalidConnection = parsed.connections.find(connection => {
    return (
      !isObject(connection) ||
      typeof connection.powensConnectionId !== 'string' ||
      typeof connection.status !== 'string' ||
      !isNumber(connection.balance) ||
      !Number.isInteger(connection.accountCount) ||
      !isStringOrNull(connection.lastSyncAt) ||
      !isStringOrNull(connection.lastSuccessAt) ||
      !isStringOrNull(connection.lastError)
    )
  })
  if (invalidConnection) {
    return 'dashboard summary contains an invalid connection entry'
  }

  const invalidAccount = parsed.accounts.find(account => {
    return (
      !isObject(account) ||
      typeof account.powensAccountId !== 'string' ||
      typeof account.powensConnectionId !== 'string' ||
      typeof account.name !== 'string' ||
      typeof account.currency !== 'string' ||
      typeof account.enabled !== 'boolean' ||
      !isNumber(account.balance)
    )
  })
  if (invalidAccount) {
    return 'dashboard summary contains an invalid account entry'
  }

  const invalidExpenseGroup = parsed.topExpenseGroups.find(group => {
    return (
      !isObject(group) ||
      typeof group.label !== 'string' ||
      typeof group.category !== 'string' ||
      typeof group.merchant !== 'string' ||
      !isNumber(group.total) ||
      !Number.isInteger(group.count)
    )
  })
  if (invalidExpenseGroup) {
    return 'dashboard summary contains an invalid topExpenseGroups entry'
  }

  if (expectedMode === 'demo') {
    const connectionIds = new Set(parsed.connections.map(connection => connection.powensConnectionId))
    const accountIds = new Set(parsed.accounts.map(account => account.powensAccountId))

    for (const expectedId of DEMO_CONNECTION_IDS) {
      if (!connectionIds.has(expectedId)) {
        return `demo dashboard summary missing connection ${expectedId}`
      }
    }

    for (const expectedId of DEMO_ACCOUNT_IDS) {
      if (!accountIds.has(expectedId)) {
        return `demo dashboard summary missing account ${expectedId}`
      }
    }
  }

  return true
}

const assertPowensStatusPayload = ({ rawBody, expectedMode }) => {
  const parsed = asJson(rawBody)
  if (!isObject(parsed)) {
    return 'powens status payload is not JSON'
  }

  if (!Array.isArray(parsed.connections)) {
    return 'powens status payload missing connections array'
  }

  if (typeof parsed.safeModeActive !== 'boolean') {
    return 'powens status payload missing safeModeActive boolean'
  }

  const invalidConnection = parsed.connections.find(connection => {
    return (
      !isObject(connection) ||
      typeof connection.powensConnectionId !== 'string' ||
      typeof connection.status !== 'string' ||
      !isStringOrNull(connection.lastSyncAt) ||
      !isStringOrNull(connection.lastSuccessAt) ||
      !isStringOrNull(connection.lastError)
    )
  })
  if (invalidConnection) {
    return 'powens status payload contains an invalid connection entry'
  }

  if (parsed.safeModeActive === true && 'fallback' in parsed && parsed.fallback !== 'safe_mode') {
    return 'powens status fallback must be safe_mode when present'
  }

  if (expectedMode === 'demo') {
    const connectionIds = new Set(parsed.connections.map(connection => connection.powensConnectionId))
    for (const expectedId of DEMO_CONNECTION_IDS) {
      if (!connectionIds.has(expectedId)) {
        return `demo powens status missing connection ${expectedId}`
      }
    }
  }

  return true
}

const finalize = async () => {
  const failed = results.filter(result => !result.ok)
  const total = results.length

  if (failed.length === 0) {
    const message = `Smoke prod checks passed (${total}/${total}) in ${authContext.resolvedMode} mode.`
    console.log(message)
    await writeSummary([
      '## Production smoke checks',
      '',
      `- ✅ Passed: ${total}/${total}`,
      `- Auth mode: ${authContext.resolvedMode}`,
      `- Summary range: ${summaryRange}`,
    ])
    return
  }

  console.error(`Smoke prod checks failed (${failed.length}/${total}) in ${authContext.resolvedMode} mode.`)
  for (const failure of failed) {
    const detail = `${failure.name} returned ${failure.status} (expected ${failure.expectedStatuses.join(', ')})${failure.assertMessage ? `; ${failure.assertMessage}` : ''}`
    console.error(`- ${detail}`)
    console.error(`  method: ${failure.method}`)
    console.error(`  url: ${failure.url}`)
    if (failure.requestId) {
      console.error(`  requestId: ${failure.requestId}`)
    }
    if (failure.bodyPreview) {
      console.error(`  body: ${failure.bodyPreview}`)
    }
    if (process.env.GITHUB_ACTIONS === 'true') {
      console.error(`::error title=Prod smoke failed::${escapeAnnotationValue(detail)}`)
    }
  }

  await writeSummary([
    '## Production smoke checks',
    '',
    `- ❌ Failed: ${failed.length}/${total}`,
    `- Auth mode: ${authContext.resolvedMode}`,
    `- Summary range: ${summaryRange}`,
    ...failed.flatMap(failure => {
      const detail = `${failure.name} returned ${failure.status} (expected ${failure.expectedStatuses.join(', ')})${failure.assertMessage ? `; ${failure.assertMessage}` : ''}`
      return [`  - ${detail}`]
    }),
  ])
}

const main = async () => {
  await resolveExpectedMode()

  await runCheck({
    name: 'health_root',
    path: '/health',
    expectedStatuses: [200],
    assert: ({ rawBody }) => assertHealthPayload({ rawBody, expectedService: 'web' }),
  })

  await runCheck({
    name: 'health_api_prefix',
    path: '/api/health',
    expectedStatuses: [200],
    assert: ({ rawBody }) => assertHealthPayload({ rawBody, expectedService: 'api' }),
  })

  await runCheck({
    name: 'version_root',
    path: '/version',
    expectedStatuses: [200],
    assert: ({ rawBody }) => assertVersionPayload({ rawBody, expectedService: 'web' }),
  })

  await runCheck({
    name: 'version_api_prefix',
    path: '/api/version',
    expectedStatuses: [200],
    assert: ({ rawBody }) => assertVersionPayload({ rawBody, expectedService: 'api' }),
  })

  await runCheck({
    name: 'auth_me_root',
    path: '/auth/me',
    expectedStatuses: [200],
    headers: withAuthHeaders(),
    assert: ({ rawBody }) => assertAuthMePayload({ rawBody, expectedMode: authContext.resolvedMode }),
  })

  await runCheck({
    name: 'auth_me_api_prefix',
    path: '/api/auth/me',
    expectedStatuses: [200],
    headers: withAuthHeaders(),
    assert: ({ rawBody }) => assertAuthMePayload({ rawBody, expectedMode: authContext.resolvedMode }),
  })

  await runCheck({
    name: 'dashboard_summary_root',
    path: `/dashboard/summary?range=${encodeURIComponent(summaryRange)}`,
    expectedStatuses: [200],
    headers: withAuthHeaders(),
    assert: ({ rawBody }) =>
      assertSummaryPayload({
        rawBody,
        expectedMode: authContext.resolvedMode,
        expectedRange: summaryRange,
      }),
  })

  await runCheck({
    name: 'dashboard_summary_api_prefix',
    path: `/api/dashboard/summary?range=${encodeURIComponent(summaryRange)}`,
    expectedStatuses: [200],
    headers: withAuthHeaders(),
    assert: ({ rawBody }) =>
      assertSummaryPayload({
        rawBody,
        expectedMode: authContext.resolvedMode,
        expectedRange: summaryRange,
      }),
  })

  await runCheck({
    name: 'powens_status_root',
    path: '/integrations/powens/status',
    expectedStatuses: [200],
    headers: withAuthHeaders(),
    assert: ({ rawBody }) =>
      assertPowensStatusPayload({
        rawBody,
        expectedMode: authContext.resolvedMode,
      }),
  })

  await runCheck({
    name: 'powens_status_api_prefix',
    path: '/api/integrations/powens/status',
    expectedStatuses: [200],
    headers: withAuthHeaders(),
    assert: ({ rawBody }) =>
      assertPowensStatusPayload({
        rawBody,
        expectedMode: authContext.resolvedMode,
      }),
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
      if (!isObject(parsed) || !Array.isArray(parsed.routes)) {
        return 'invalid /__routes payload'
      }

      const registered = new Set(
        parsed.routes
          .filter(route => isObject(route))
          .map(route => `${String(route.method).toUpperCase()} ${String(route.path)}`)
      )
      const missing = REQUIRED_ROUTES.filter(route => !registered.has(route))
      if (missing.length > 0) {
        return `missing required routes: ${missing.join(', ')}`
      }

      return true
    },
  })

  await finalize()
}

await main()
