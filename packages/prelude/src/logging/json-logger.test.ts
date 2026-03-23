import { afterEach, describe, expect, it, mock } from 'bun:test'
import { createJsonLogger, toErrorLogFields } from './json-logger'

const logger = createJsonLogger({ service: 'api' })

const originalLogLevel = process.env.LOG_LEVEL

afterEach(() => {
  process.env.LOG_LEVEL = originalLogLevel
  mock.restore()
})

describe('createJsonLogger', () => {
  it('redacts sensitive fields and emits structured JSON payloads', () => {
    process.env.LOG_LEVEL = 'info'

    const logSpy = mock(() => {})
    console.log = logSpy

    logger.logEvent({
      level: 'info',
      msg: 'request completed',
      authorization: 'Bearer super-secret-token',
      url: 'https://api.local/powens/callback?code=abc123&state=ok',
      nested: {
        refresh_token: 'raw-refresh-token',
        payload: '{"access_token":"leaky-token"}',
      },
    })

    expect(logSpy).toHaveBeenCalledTimes(1)
    const payload = JSON.parse(logSpy.mock.calls[0]?.[0] as string) as Record<string, unknown>

    expect(payload.service).toBe('api')
    expect(payload.level).toBe('info')
    expect(payload.msg).toBe('request completed')
    expect(payload.authorization).toBe('[REDACTED]')
    expect(payload.url).toBe('https://api.local/powens/callback?code=[REDACTED]&state=ok')
    expect(payload.nested).toEqual({
      refresh_token: '[REDACTED]',
      payload: '{"access_token":"[REDACTED]"}',
    })
  })

  it('uses warn and error writers for matching levels', () => {
    process.env.LOG_LEVEL = 'debug'

    const warnSpy = mock(() => {})
    const errorSpy = mock(() => {})
    console.warn = warnSpy
    console.error = errorSpy

    logger.logEvent({
      level: 'warn',
      msg: 'degraded dependency',
    })
    logger.logEvent({
      level: 'error',
      msg: 'dependency failed',
    })

    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledTimes(1)
  })
})

describe('toErrorLogFields', () => {
  it('omits stack when includeStack is false and redacts sensitive fragments', () => {
    const error = new Error('request failed with code=foo and Bearer token-123')
    const fields = toErrorLogFields({
      error,
      includeStack: false,
    }) as Record<string, unknown>

    expect(fields.errName).toBe('Error')
    expect(fields.errMessage).toContain('code=[REDACTED]')
    expect(fields.errMessage).toContain('Bearer [REDACTED]')
    expect(Object.hasOwn(fields, 'stack')).toBe(false)
  })

  it('includes redacted stack when includeStack is true', () => {
    const error = new Error('failed code=abc')
    error.stack = 'Error: failed code=abc\n at auth (token=secret-123)'

    const fields = toErrorLogFields({
      error,
      includeStack: true,
    }) as Record<string, unknown>

    expect(fields.stack).toBe('Error: failed code=[REDACTED]\n at auth (token=[REDACTED])')
  })
})
