const DEFAULT_5XX_WINDOW_MS = 5 * 60 * 1000
const DEFAULT_5XX_THRESHOLD = 3
const DEFAULT_HEALTH_FAILURE_THRESHOLD = 2
const DEFAULT_DISK_FREE_PERCENT_THRESHOLD = 10

export const DEFAULT_ALERTS = Object.freeze({
  fiveXxWindowMs: DEFAULT_5XX_WINDOW_MS,
  fiveXxThreshold: DEFAULT_5XX_THRESHOLD,
  healthFailureThreshold: DEFAULT_HEALTH_FAILURE_THRESHOLD,
  diskFreePercentThreshold: DEFAULT_DISK_FREE_PERCENT_THRESHOLD,
})

export const parseBooleanEnv = (value, fallback = false) => {
  if (value == null || value === '') {
    return fallback
  }

  const normalized = String(value).trim().toLowerCase()

  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false
  }

  return fallback
}

export const parsePositiveNumberEnv = (value, fallback) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }

  return parsed
}

export const pruneWindow = (timestamps, now, windowMs) => {
  return timestamps.filter(timestamp => now - timestamp <= windowMs)
}

export const register5xxEvent = (timestamps, now, windowMs, statusCode) => {
  const pruned = pruneWindow(timestamps, now, windowMs)

  if (statusCode >= 500) {
    pruned.push(now)
  }

  return pruned
}

export const is5xxBurstActive = (timestamps, now, windowMs, threshold) => {
  return pruneWindow(timestamps, now, windowMs).length >= threshold
}

export const nextConsecutiveFailures = (current, ok) => {
  return ok ? 0 : current + 1
}

export const isHealthcheckAlertActive = (consecutiveFailures, threshold) => {
  return consecutiveFailures >= threshold
}

export const evaluateWorkerHeartbeat = ({ now, heartbeatTimestamp, staleAfterMs }) => {
  if (!Number.isFinite(heartbeatTimestamp)) {
    return {
      active: true,
      reason: 'missing_or_invalid_timestamp',
      ageMs: null,
    }
  }

  const ageMs = now - heartbeatTimestamp

  if (ageMs > staleAfterMs) {
    return {
      active: true,
      reason: 'stale_heartbeat',
      ageMs,
    }
  }

  return {
    active: false,
    reason: 'healthy',
    ageMs,
  }
}

export const evaluateDiskFreePercent = ({ freePercent, thresholdPercent }) => {
  if (!Number.isFinite(freePercent)) {
    return {
      active: true,
      reason: 'missing_disk_metric',
    }
  }

  if (freePercent <= thresholdPercent) {
    return {
      active: true,
      reason: 'low_disk_free_percent',
    }
  }

  return {
    active: false,
    reason: 'healthy',
  }
}

export const formatPercent = value => {
  if (!Number.isFinite(value)) {
    return 'n/a'
  }

  return `${value.toFixed(1)}%`
}

export const buildAlertPayload = ({
  status,
  family,
  severity,
  summary,
  details,
  source = 'finance-os',
  timestamp,
}) => {
  const payload = {
    source,
    status,
    family,
    severity,
    summary,
    details,
    timestamp,
  }

  return payload
}
