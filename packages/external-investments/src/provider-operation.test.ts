import { describe, expect, it } from 'bun:test'
import {
  redactExternalProviderErrorMessage,
  runExternalInvestmentProviderOperation,
} from './provider-operation'

describe('external investment provider operation effect boundary', () => {
  it('retries transient provider failures and returns the successful value', async () => {
    let calls = 0

    const result = await runExternalInvestmentProviderOperation({
      provider: 'ibkr',
      operation: 'fetch-flex-statement',
      timeoutMs: 1_000,
      retryAttempts: 1,
      run: async () => {
        calls += 1
        if (calls === 1) {
          throw new Error('temporary IBKR outage token=secret-token-value')
        }
        return { reportId: 'ok' }
      },
    })

    expect(result).toMatchObject({
      ok: true,
      value: { reportId: 'ok' },
      attempts: 2,
      fallbackUsed: false,
    })
  })

  it('maps timeout failures into safe typed provider errors', async () => {
    const result = await runExternalInvestmentProviderOperation({
      provider: 'binance',
      operation: 'fetch-account-snapshot',
      timeoutMs: 5,
      retryAttempts: 0,
      run: () => new Promise<never>(() => {}),
    })

    expect(result).toMatchObject({
      ok: false,
      attempts: 1,
      fallbackUsed: false,
      error: {
        provider: 'binance',
        operation: 'fetch-account-snapshot',
        kind: 'timeout',
        retryable: true,
        message: 'fetch-account-snapshot timed out',
      },
    })
  })

  it('supports fail-soft fallback values while preserving the safe error', async () => {
    const result = await runExternalInvestmentProviderOperation({
      provider: 'external-investments',
      operation: 'build-context-bundle',
      timeoutMs: 1_000,
      retryAttempts: 0,
      run: async () => {
        throw new Error('provider failed api_key=super-secret')
      },
      fallback: () => ({ positions: [] as unknown[] }),
    })

    expect(result).toMatchObject({
      ok: true,
      value: { positions: [] },
      attempts: 1,
      fallbackUsed: true,
      error: {
        provider: 'external-investments',
        operation: 'build-context-bundle',
        kind: 'provider_error',
        retryable: true,
      },
    })
    expect(result.error.message).not.toContain('super-secret')
  })

  it('redacts common provider credential patterns from error messages', () => {
    const message = redactExternalProviderErrorMessage(
      'GET /api?signature=abc123&access_token=token123 failed with Bearer raw-token and 0123456789abcdef0123456789abcdef'
    )

    expect(message).not.toContain('abc123')
    expect(message).not.toContain('token123')
    expect(message).not.toContain('raw-token')
    expect(message).not.toContain('0123456789abcdef0123456789abcdef')
    expect(message).toContain('signature=[redacted]')
    expect(message).toContain('access_token=[redacted]')
  })
})
