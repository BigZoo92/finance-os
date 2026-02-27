type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

const toConfiguredLogLevel = (): LogLevel => {
  const raw = process.env.LOG_LEVEL?.trim().toLowerCase()
  if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') {
    return raw
  }

  return 'info'
}

export const isApiDebugEnabled = () => {
  return toConfiguredLogLevel() === 'debug' || process.env.APP_DEBUG === '1'
}

const shouldLog = (level: LogLevel) => {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[toConfiguredLogLevel()]
}

const toSerializableValue = (value: unknown): unknown => {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
    }
  }

  if (typeof value === 'bigint') {
    return value.toString()
  }

  return value
}

export const logApiEvent = ({
  level,
  msg,
  ...fields
}: {
  level: LogLevel
  msg: string
  [key: string]: unknown
}) => {
  if (!shouldLog(level)) {
    return
  }

  const payload = {
    timestamp: new Date().toISOString(),
    level,
    msg,
    ...Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, toSerializableValue(value)])),
  }

  const line = JSON.stringify(payload)
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

export const toErrorLogFields = ({
  error,
  includeStack,
}: {
  error: unknown
  includeStack: boolean
}) => {
  const err = error instanceof Error ? error : new Error(String(error))

  return {
    errName: err.name,
    errMessage: err.message,
    stack: includeStack ? err.stack : undefined,
  }
}
