import { describe, expect, it } from 'bun:test'
import { ProviderOperationError, runProviderOperation, runProviderOperationOrThrow } from './policy'

class ClientError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly statusCode?: number
  ) {
    super(message)
    this.name = 'ClientError'
  }
}

const fastRetry = (maxAttempts: number) => ({
  maxAttempts,
  baseDelayMs: 1,
  maxDelayMs: 2,
  jitter: false,
})

describe('runProviderOperation', () => {
  it('returns the value of a successful first attempt', async () => {
    const outcome = await runProviderOperation({
      provider: 'demo',
      operation: 'ping',
      policy: { timeoutMs: 100, retry: fastRetry(3) },
      run: async () => 'pong',
    })
    expect(outcome).toMatchObject({ ok: true, value: 'pong', attempts: 1 })
  })

  it('retries transient failures up to the attempt budget and keeps the client error as cause', async () => {
    let calls = 0
    const outcome = await runProviderOperation({
      provider: 'demo',
      operation: 'list',
      policy: { timeoutMs: 100, retry: fastRetry(3) },
      run: async () => {
        calls += 1
        throw new ClientError(`boom ${calls}`, true, 503)
      },
    })
    expect(calls).toBe(3)
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) {
      expect(outcome.error).toBeInstanceOf(ProviderOperationError)
      expect(outcome.error.kind).toBe('failed')
      expect(outcome.error.status).toBe(503)
      expect(outcome.error.cause).toBeInstanceOf(ClientError)
      expect(outcome.attempts).toBe(3)
    }
  })

  it('does not retry errors classified as permanent', async () => {
    let calls = 0
    const outcome = await runProviderOperation({
      provider: 'demo',
      operation: 'auth',
      policy: { timeoutMs: 100, retry: fastRetry(4) },
      run: async () => {
        calls += 1
        throw new ClientError('forbidden', false, 403)
      },
    })
    expect(calls).toBe(1)
    expect(outcome.ok).toBe(false)
  })

  it('recovers when a retry succeeds', async () => {
    let calls = 0
    const outcome = await runProviderOperation({
      provider: 'demo',
      operation: 'quote',
      policy: { timeoutMs: 100, retry: fastRetry(3) },
      run: async () => {
        calls += 1
        if (calls < 3) throw new TypeError('fetch failed')
        return 42
      },
    })
    expect(outcome).toMatchObject({ ok: true, value: 42, attempts: 3 })
  })

  it('times out an attempt, aborts its signal, and reports a retryable timeout', async () => {
    let aborted = false
    const outcome = await runProviderOperation({
      provider: 'demo',
      operation: 'slow',
      policy: { timeoutMs: 20 },
      run: signal =>
        new Promise<never>((_, reject) => {
          signal.addEventListener('abort', () => {
            aborted = true
            reject(new DOMException('aborted', 'AbortError'))
          })
        }),
    })
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) {
      expect(outcome.error.kind).toBe('timeout')
      expect(outcome.error.retryable).toBe(true)
    }
    expect(aborted).toBe(true)
  })

  it('stops retrying and reports a cancellation when the caller aborts', async () => {
    const controller = new AbortController()
    let calls = 0
    const pending = runProviderOperation({
      provider: 'demo',
      operation: 'sync',
      policy: { timeoutMs: 1_000, retry: fastRetry(5) },
      signal: controller.signal,
      run: async signal => {
        calls += 1
        await new Promise<void>((resolve, reject) => {
          signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
          setTimeout(resolve, 5)
        })
        throw new ClientError('transient', true)
      },
    })
    setTimeout(() => controller.abort(), 12)
    const outcome = await pending
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) {
      expect(outcome.error.kind).toBe('cancelled')
      expect(outcome.error.retryable).toBe(false)
    }
    expect(calls).toBeLessThan(5)
  })

  it('never puts secrets in the safe message when a custom classification is used', async () => {
    const outcome = await runProviderOperation({
      provider: 'demo',
      operation: 'signed',
      policy: { timeoutMs: 50 },
      run: async () => {
        throw new Error('signature=abcdef0123456789abcdef0123456789 rejected')
      },
      classify: () => ({ retryable: false, message: 'signed request rejected' }),
    })
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) {
      expect(outcome.error.message).toBe('signed request rejected')
      expect(JSON.stringify(outcome.error.message)).not.toContain('abcdef')
    }
  })
})

describe('runProviderOperationOrThrow', () => {
  it('rethrows the original client error for failed outcomes', async () => {
    await expect(
      runProviderOperationOrThrow({
        provider: 'demo',
        operation: 'get',
        policy: { timeoutMs: 50 },
        run: async () => {
          throw new ClientError('nope', false, 404)
        },
      })
    ).rejects.toBeInstanceOf(ClientError)
  })

  it('throws the policy error for timeouts', async () => {
    await expect(
      runProviderOperationOrThrow({
        provider: 'demo',
        operation: 'hang',
        policy: { timeoutMs: 10 },
        run: () => new Promise<never>(() => {}),
      })
    ).rejects.toBeInstanceOf(ProviderOperationError)
  })
})
