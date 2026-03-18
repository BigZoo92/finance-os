import { describe, expect, it } from 'bun:test'
import { logApiEvent, toErrorLogFields } from './logger'

describe('logApiEvent redaction', () => {
  it('redacts sensitive keys and token-like string fragments', () => {
    const lines: string[] = []
    const originalLog = console.log
    console.log = (...args: unknown[]) => {
      lines.push(args.map(value => String(value)).join(' '))
    }

    try {
      logApiEvent({
        level: 'info',
        msg: 'request completed',
        authorization: 'Bearer super-secret-token',
        url: 'https://api.local/powens/callback?code=abc123&state=ok',
        nested: {
          refresh_token: 'raw-refresh-token',
          payload: '{"access_token":"leaky-token"}',
        },
      })
    } finally {
      console.log = originalLog
    }

    expect(lines).toHaveLength(1)
    const [line] = lines
    if (!line) {
      throw new Error('expected a log line')
    }
    const payload = JSON.parse(line) as Record<string, unknown>

    expect(payload.service).toBe('api')
    expect(payload.authorization).toBe('[REDACTED]')
    expect(payload.url).toBe('https://api.local/powens/callback?code=[REDACTED]&state=ok')
    expect(payload.nested).toEqual({
      refresh_token: '[REDACTED]',
      payload: '{"access_token":"[REDACTED]"}',
    })
  })
})

describe('toErrorLogFields redaction', () => {
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
