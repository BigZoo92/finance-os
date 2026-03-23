#!/usr/bin/env node

import { appendFile } from 'node:fs/promises'

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
const results = []

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

const runCheck = async ({ name, path, expectedStatuses, headers = {}, assert }) => {
  const url = `${baseUrl}${path}`
  let response
  let text = ''
  let bodyPreview = ''
  let statusOk = false

  try {
    response = await fetch(url, {
      method: 'GET',
      headers,
    })
    text = await response.text()
    bodyPreview = text.trim().slice(0, 250)
    statusOk = expectedStatuses.includes(response.status)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    results.push({
      name,
      url,
      status: 'fetch_error',
      expectedStatuses,
      ok: false,
      assertMessage: message,
      bodyPreview: '',
    })
    console.log(
      JSON.stringify({
        name,
        url,
        status: 'fetch_error',
        expectedStatuses,
        ok: false,
        assertMessage: message,
        bodyPreview: '',
      })
    )
    process.exitCode = 1
    return
  }

  let assertOk = true
  let assertMessage = null
  if (typeof assert === 'function') {
    const result = await assert({ response, rawBody: text })
    if (result !== true) {
      assertOk = false
      assertMessage = typeof result === 'string' ? result : 'custom assertion failed'
    }
  }

  const ok = statusOk && assertOk
  results.push({
    name,
    url,
    status: response.status,
    expectedStatuses,
    ok,
    assertMessage,
    bodyPreview,
  })

  console.log(
    JSON.stringify({
      name,
      url,
      status: response.status,
      expectedStatuses,
      ok,
      assertMessage,
      bodyPreview,
    })
  )

  if (!ok) {
    process.exitCode = 1
  }
}

const finalize = async () => {
  const failed = results.filter(result => !result.ok)
  const total = results.length

  if (failed.length === 0) {
    const message = `Smoke API checks passed (${total}/${total}).`
    console.log(message)
    await writeSummary([
      '## API smoke checks',
      '',
      `- ✅ Passed: ${total}/${total}`,
    ])
    return
  }

  console.error(`Smoke API checks failed (${failed.length}/${total}).`)
  for (const failure of failed) {
    const detail = `${failure.name} returned ${failure.status} (expected ${failure.expectedStatuses.join(', ')})${failure.assertMessage ? `; ${failure.assertMessage}` : ''}`
    console.error(`- ${detail}`)
    console.error(`  url: ${failure.url}`)
    if (failure.bodyPreview) {
      console.error(`  body: ${failure.bodyPreview}`)
    }
    if (process.env.GITHUB_ACTIONS === 'true') {
      console.error(`::error title=API smoke failed::${escapeAnnotationValue(detail)}`)
    }
  }

  await writeSummary([
    '## API smoke checks',
    '',
    `- ❌ Failed: ${failed.length}/${total}`,
    ...failed.flatMap(failure => {
      const detail = `${failure.name} returned ${failure.status} (expected ${failure.expectedStatuses.join(', ')})${failure.assertMessage ? `; ${failure.assertMessage}` : ''}`
      return [`  - ${detail}`]
    }),
  ])
}

const main = async () => {
  await runCheck({
    name: 'health',
    path: '/health',
    expectedStatuses: [200],
    assert: ({ rawBody }) => {
      const parsed = asJson(rawBody)
      if (!parsed || typeof parsed !== 'object') {
        return 'health payload is not JSON'
      }

      if (parsed.ok !== true || parsed.service !== 'api') {
        return 'health payload must contain ok=true and service=api'
      }

      return true
    },
  })

  await runCheck({
    name: 'version',
    path: '/version',
    expectedStatuses: [200],
    assert: ({ rawBody }) => {
      const parsed = asJson(rawBody)
      if (!parsed || typeof parsed !== 'object') {
        return 'version payload is not JSON'
      }

      if (parsed.service !== 'api' || !('NODE_ENV' in parsed)) {
        return 'version payload must contain service=api and NODE_ENV'
      }

      return true
    },
  })

  await runCheck({
    name: 'auth_me_without_cookie',
    path: '/auth/me',
    expectedStatuses: [200],
  })

  await runCheck({
    name: 'debug_ping',
    path: '/debug/ping',
    expectedStatuses: [200],
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

  await finalize()
}

await main()
