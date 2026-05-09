// PR17B — Provider result helpers.
//
// Constructors and pure transforms for the discriminated union ProviderResult.
// Both branches carry meta — these helpers refuse to construct a result without it.

import type {
  ProviderError,
  ProviderMeta,
  ProviderResult,
  ProviderResultErr,
  ProviderResultOk,
} from '@finance-os/provider-contract'

export const providerOk = <T>(data: T, meta: ProviderMeta): ProviderResultOk<T> => {
  return { ok: true, data, meta }
}

export const providerErr = (error: ProviderError, meta: ProviderMeta): ProviderResultErr => {
  return { ok: false, error, meta }
}

export const mapProviderResult = <TIn, TOut>(
  result: ProviderResult<TIn>,
  mapper: (data: TIn) => TOut
): ProviderResult<TOut> => {
  if (result.ok) {
    return { ok: true, data: mapper(result.data), meta: result.meta }
  }
  return result
}

export const mapProviderError = <T>(
  result: ProviderResult<T>,
  mapper: (error: ProviderError) => ProviderError
): ProviderResult<T> => {
  if (result.ok) {
    return result
  }
  return { ok: false, error: mapper(result.error), meta: result.meta }
}

/**
 * Test/internal-use only. Application code SHOULD pattern-match on `result.ok` rather
 * than calling this — the whole point of `ProviderResult` is to make failures explicit.
 */
export const unwrapProviderResultOrThrow = <T>(result: ProviderResult<T>): T => {
  if (result.ok) {
    return result.data
  }
  const code = result.error.code
  const cause = result.error.causeRedacted ?? '(no detail)'
  throw new Error(`unwrapProviderResultOrThrow: ${code} from ${result.error.providerId} — ${cause}`)
}
