export type JsonLogLevel = 'debug' | 'info' | 'warn' | 'error'

type JsonLogger = {
  getConfiguredLogLevel: () => JsonLogLevel
  logEvent: (event: {
    level: JsonLogLevel
    msg: string
    [key: string]: unknown
  }) => void
}

const REDACTED_VALUE = '[REDACTED]'
const SENSITIVE_KEY_PATTERN =
  /token|secret|password|authorization|cookie|api[_-]?key|x-internal-token|x-finance-os-access-token|code/i
const SENSITIVE_QUERY_PATTERN =
  /([?&]\s*(?:token|access_token|refresh_token|secret|password|api[_-]?key|code)=)[^&#\s]*/gi
const SENSITIVE_JSON_PATTERN =
  /("(?:token|access_token|refresh_token|secret|password|authorization|cookie|api[_-]?key|code)"\s*:\s*")[^"]*(")/gi
const BEARER_PATTERN = /(Bearer\s+)[^\s,;]+/gi
const SENSITIVE_KV_PATTERN =
  /(\b(?:token|access_token|refresh_token|secret|password|api[_-]?key|code)\s*=\s*)[^\s,;)&}]+/gi

const LOG_LEVEL_PRIORITY: Record<JsonLogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

const redactString = (value: string) => {
  return value
    .replace(SENSITIVE_QUERY_PATTERN, `$1${REDACTED_VALUE}`)
    .replace(SENSITIVE_JSON_PATTERN, `$1${REDACTED_VALUE}$2`)
    .replace(BEARER_PATTERN, `$1${REDACTED_VALUE}`)
    .replace(SENSITIVE_KV_PATTERN, `$1${REDACTED_VALUE}`)
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

const redactByKey = ({ key, value }: { key?: string; value: unknown }): unknown => {
  if (key && SENSITIVE_KEY_PATTERN.test(key)) {
    return REDACTED_VALUE
  }

  if (typeof value === 'string') {
    return redactString(value)
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
    }
  }

  if (Array.isArray(value)) {
    return value.map(entry => redactByKey({ value: entry }))
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        redactByKey({
          key: entryKey,
          value: entryValue,
        }),
      ])
    )
  }

  return value
}

const toConfiguredLogLevel = (): JsonLogLevel => {
  const raw = process.env.LOG_LEVEL?.trim().toLowerCase()
  if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') {
    return raw
  }

  return 'info'
}

const shouldLog = (level: JsonLogLevel, configuredLevel: JsonLogLevel) => {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[configuredLevel]
}

const toSerializableValue = (value: unknown): unknown => {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
    }
  }

  if (typeof value === 'bigint') {
    return value.toString()
  }

  return redactByKey({ value })
}

const writeLogLine = (level: JsonLogLevel, line: string) => {
  if (level === 'error') {
    console.error(line)
    return
  }

  if (level === 'warn') {
    console.warn(line)
    return
  }

  console.log(line)
}

export const createJsonLogger = ({ service }: { service: string }): JsonLogger => {
  return {
    getConfiguredLogLevel: toConfiguredLogLevel,
    logEvent: ({ level, msg, ...fields }) => {
      const configuredLevel = toConfiguredLogLevel()
      if (!shouldLog(level, configuredLevel)) {
        return
      }

      const payload = {
        timestamp: new Date().toISOString(),
        service,
        level,
        msg,
        ...Object.fromEntries(
          Object.entries(fields).map(([key, value]) => [
            key,
            redactByKey({
              key,
              value: toSerializableValue(value),
            }),
          ])
        ),
      }

      writeLogLine(level, JSON.stringify(payload))
    },
  }
}

export const toErrorLogFields = ({
  error,
  includeStack,
}: {
  error: unknown
  includeStack: boolean
}) => {
  const err = error instanceof Error ? error : new Error(String(error))

  const fields = {
    errName: err.name,
    errMessage: redactString(err.message),
  }

  if (!includeStack || !err.stack) {
    return fields
  }

  return {
    ...fields,
    stack: redactString(err.stack),
  }
}
