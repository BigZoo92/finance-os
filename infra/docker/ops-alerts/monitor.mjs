import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import process from 'node:process'
import {
  buildAlertPayload,
  DEFAULT_ALERTS,
  evaluateDiskFreePercent,
  evaluateWorkerHeartbeat,
  formatPercent,
  is5xxBurstActive,
  isHealthcheckAlertActive,
  nextConsecutiveFailures,
  parseBooleanEnv,
  parsePositiveNumberEnv,
  register5xxEvent,
} from './monitor-lib.mjs'

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

const parseHeaderEntries = raw => {
  if (!raw || raw.trim().length === 0) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw)

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('headers must be a JSON object')
    }

    return Object.fromEntries(
      Object.entries(parsed)
        .filter(entry => typeof entry[1] === 'string' && entry[1].length > 0)
        .map(([key, value]) => [key, value])
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`ALERTS_WEBHOOK_HEADERS_JSON is invalid: ${message}`)
  }
}

const parseProbeTargets = (raw, fallback) => {
  if (!raw || raw.trim().length === 0) {
    return fallback
  }

  return raw
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean)
}

const parseDiskPaths = raw => {
  const fallback = ['/mnt/postgres', '/mnt/redis']

  return parseProbeTargets(raw, fallback)
}

const config = {
  enabled: parseBooleanEnv(process.env.ALERTS_ENABLED, false),
  pollIntervalMs: parsePositiveNumberEnv(process.env.ALERTS_POLL_INTERVAL_MS, 30_000),
  webhookUrl: process.env.ALERTS_WEBHOOK_URL?.trim() ?? '',
  webhookHeaders: parseHeaderEntries(process.env.ALERTS_WEBHOOK_HEADERS_JSON ?? ''),
  httpTimeoutMs: parsePositiveNumberEnv(process.env.ALERTS_HTTP_TIMEOUT_MS, 5_000),
  fiveXxWindowMs: parsePositiveNumberEnv(
    process.env.ALERTS_5XX_WINDOW_MS,
    DEFAULT_ALERTS.fiveXxWindowMs
  ),
  fiveXxThreshold: parsePositiveNumberEnv(
    process.env.ALERTS_5XX_THRESHOLD,
    DEFAULT_ALERTS.fiveXxThreshold
  ),
  healthFailureThreshold: parsePositiveNumberEnv(
    process.env.ALERTS_HEALTHCHECK_FAILURE_THRESHOLD,
    DEFAULT_ALERTS.healthFailureThreshold
  ),
  diskFreePercentThreshold: parsePositiveNumberEnv(
    process.env.ALERTS_DISK_FREE_PERCENT_THRESHOLD,
    DEFAULT_ALERTS.diskFreePercentThreshold
  ),
  workerHeartbeatFile:
    process.env.ALERTS_WORKER_HEARTBEAT_FILE ??
    process.env.WORKER_HEALTHCHECK_FILE ??
    '/var/run/finance-os/worker-heartbeat',
  workerStaleAfterMs: parsePositiveNumberEnv(
    process.env.ALERTS_WORKER_STALE_AFTER_MS ?? process.env.WORKER_HEALTHCHECK_MAX_AGE_MS,
    120_000
  ),
  fiveXxProbeUrls: parseProbeTargets(process.env.ALERTS_5XX_PROBE_URLS, [
    'http://web:3000/api/auth/me',
    'http://web:3000/api/dashboard/summary?range=30d',
  ]),
  healthProbeUrls: parseProbeTargets(process.env.ALERTS_HEALTHCHECK_URLS, [
    'http://web:3000/healthz',
    'http://finance-os-api:3001/health',
  ]),
  diskPaths: parseDiskPaths(process.env.ALERTS_DISK_PATHS),
}

if (config.enabled && config.webhookUrl.length === 0) {
  console.error('[ops-alerts] ALERTS_WEBHOOK_URL is required when ALERTS_ENABLED=true')
  process.exit(1)
}

const alertState = new Map()
const fiveXxEvents = []
const healthFailureCounts = new Map(config.healthProbeUrls.map(url => [url, 0]))

const logEvent = (level, payload) => {
  const entry = {
    service: 'ops-alerts',
    level,
    ts: new Date().toISOString(),
    ...payload,
  }

  const serialized = JSON.stringify(entry)
  if (level === 'error') {
    console.error(serialized)
    return
  }

  console.log(serialized)
}

const fetchStatus = async url => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.httpTimeoutMs)

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    })

    return {
      ok: response.ok,
      statusCode: response.status,
      error: null,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      ok: false,
      statusCode: null,
      error: message,
    }
  } finally {
    clearTimeout(timeout)
  }
}

const sendWebhook = async payload => {
  if (!config.enabled) {
    logEvent('info', {
      msg: 'alert webhook skipped because alerting is disabled',
      payload,
    })
    return
  }

  const response = await fetch(config.webhookUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...config.webhookHeaders,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`webhook returned ${response.status}`)
  }
}

const transitionAlert = async ({ key, family, severity, active, summary, details, now }) => {
  const previous = alertState.get(key) ?? false

  if (previous === active) {
    return
  }

  alertState.set(key, active)

  const status = active ? 'triggered' : 'resolved'
  const payload = buildAlertPayload({
    status,
    family,
    severity,
    summary,
    details,
    timestamp: now.toISOString(),
  })

  try {
    await sendWebhook(payload)
    logEvent(active ? 'warn' : 'info', {
      msg: `alert ${status}`,
      family,
      key,
      summary,
      details,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logEvent('error', {
      msg: 'alert delivery failed',
      family,
      key,
      error: message,
    })
  }
}

const readHeartbeatTimestamp = async filePath => {
  try {
    const raw = await readFile(filePath, 'utf8')
    return Number(raw.trim())
  } catch {
    return Number.NaN
  }
}

const readDiskUsage = path => {
  try {
    const raw = execFileSync('df', ['-Pk', path], {
      encoding: 'utf8',
    })
      .trim()
      .split('\n')
      .filter(Boolean)

    const lastLine = raw.at(-1)
    if (!lastLine) {
      return {
        path,
        freePercent: Number.NaN,
        availableKb: null,
        totalKb: null,
      }
    }

    const columns = lastLine.trim().split(/\s+/)
    const totalKb = Number(columns[1])
    const availableKb = Number(columns[3])
    const freePercent =
      Number.isFinite(totalKb) && totalKb > 0 && Number.isFinite(availableKb)
        ? (availableKb / totalKb) * 100
        : Number.NaN

    return {
      path,
      freePercent,
      availableKb: Number.isFinite(availableKb) ? availableKb : null,
      totalKb: Number.isFinite(totalKb) ? totalKb : null,
    }
  } catch {
    return {
      path,
      freePercent: Number.NaN,
      availableKb: null,
      totalKb: null,
    }
  }
}

const checkFiveXxBurst = async now => {
  const probeResults = []

  for (const url of config.fiveXxProbeUrls) {
    const result = await fetchStatus(url)
    probeResults.push({ url, ...result })

    const timestamp = now.getTime()
    const statusCode = result.statusCode ?? 0
    fiveXxEvents.splice(
      0,
      fiveXxEvents.length,
      ...register5xxEvent(fiveXxEvents, timestamp, config.fiveXxWindowMs, statusCode)
    )
  }

  const active = is5xxBurstActive(
    fiveXxEvents,
    now.getTime(),
    config.fiveXxWindowMs,
    config.fiveXxThreshold
  )

  await transitionAlert({
    key: 'family:5xx',
    family: '5xx_burst',
    severity: 'warning',
    active,
    summary: active
      ? `${fiveXxEvents.length} reponses 5xx observees sur ${Math.round(config.fiveXxWindowMs / 60_000)} min`
      : 'Burst 5xx resolu sur les endpoints surveilles',
    details: {
      threshold: config.fiveXxThreshold,
      windowMs: config.fiveXxWindowMs,
      eventsInWindow: fiveXxEvents.length,
      probes: probeResults,
    },
    now,
  })
}

const checkHealthchecks = async now => {
  for (const url of config.healthProbeUrls) {
    const result = await fetchStatus(url)
    const nextCount = nextConsecutiveFailures(healthFailureCounts.get(url) ?? 0, result.ok)
    healthFailureCounts.set(url, nextCount)

    const active = isHealthcheckAlertActive(nextCount, config.healthFailureThreshold)

    await transitionAlert({
      key: `health:${url}`,
      family: 'healthcheck_failure',
      severity: 'critical',
      active,
      summary: active
        ? `Healthcheck en echec sur ${url}`
        : `Healthcheck revenu a la normale sur ${url}`,
      details: {
        url,
        consecutiveFailures: nextCount,
        threshold: config.healthFailureThreshold,
        statusCode: result.statusCode,
        error: result.error,
      },
      now,
    })
  }
}

const checkWorkerHeartbeat = async now => {
  const heartbeatTimestamp = await readHeartbeatTimestamp(config.workerHeartbeatFile)
  const outcome = evaluateWorkerHeartbeat({
    now: now.getTime(),
    heartbeatTimestamp,
    staleAfterMs: config.workerStaleAfterMs,
  })

  await transitionAlert({
    key: 'family:worker',
    family: 'worker_stalled',
    severity: 'critical',
    active: outcome.active,
    summary: outcome.active
      ? 'Heartbeat worker stale ou introuvable'
      : 'Heartbeat worker revenu a la normale',
    details: {
      heartbeatFile: config.workerHeartbeatFile,
      staleAfterMs: config.workerStaleAfterMs,
      ageMs: outcome.ageMs,
      reason: outcome.reason,
    },
    now,
  })
}

const checkDisk = async now => {
  for (const path of config.diskPaths) {
    const usage = readDiskUsage(path)
    const outcome = evaluateDiskFreePercent({
      freePercent: usage.freePercent,
      thresholdPercent: config.diskFreePercentThreshold,
    })

    await transitionAlert({
      key: `disk:${path}`,
      family: 'disk_low',
      severity: 'critical',
      active: outcome.active,
      summary: outcome.active
        ? `Espace disque faible sur ${path}`
        : `Espace disque revenu a la normale sur ${path}`,
      details: {
        path,
        freePercent: usage.freePercent,
        freePercentFormatted: formatPercent(usage.freePercent),
        thresholdPercent: config.diskFreePercentThreshold,
        availableKb: usage.availableKb,
        totalKb: usage.totalKb,
        reason: outcome.reason,
      },
      now,
    })
  }
}

const runOnce = async () => {
  const now = new Date()

  await checkFiveXxBurst(now)
  await checkHealthchecks(now)
  await checkWorkerHeartbeat(now)
  await checkDisk(now)
}

const idleForever = async () => {
  logEvent('info', {
    msg: 'ops alerting disabled; monitor is idling',
  })

  // eslint-disable-next-line no-constant-condition
  while (true) {
    await sleep(60_000)
  }
}

if (!config.enabled) {
  await idleForever()
}

logEvent('info', {
  msg: 'ops alert monitor started',
  fiveXxThreshold: config.fiveXxThreshold,
  fiveXxWindowMs: config.fiveXxWindowMs,
  healthFailureThreshold: config.healthFailureThreshold,
  diskFreePercentThreshold: config.diskFreePercentThreshold,
  workerHeartbeatFile: config.workerHeartbeatFile,
  workerStaleAfterMs: config.workerStaleAfterMs,
})

// eslint-disable-next-line no-constant-condition
while (true) {
  try {
    await runOnce()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logEvent('error', {
      msg: 'ops alert monitor iteration failed',
      error: message,
    })
  }

  await sleep(config.pollIntervalMs)
}
