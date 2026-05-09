// PR17A — ProviderResult (TYPES ONLY).
//
// `ProviderResult<TOutput>` is the discriminated union every provider call returns. The
// `ok` boolean is the discriminant — TypeScript narrows `data` vs `error` based on its
// value, and there is no third state.
//
// The `meta` envelope is REQUIRED on both branches. Even an error MUST carry the request
// id and provenance so the audit/explain layer can show users which provider failed and
// why a recommendation has a hole in it.

import type { ProviderError } from './error'
import type { ProviderMeta } from './meta'

export interface ProviderResultOk<TOutput> {
  readonly ok: true
  readonly data: TOutput
  readonly meta: ProviderMeta
}

export interface ProviderResultErr {
  readonly ok: false
  readonly error: ProviderError
  readonly meta: ProviderMeta
}

export type ProviderResult<TOutput> = ProviderResultOk<TOutput> | ProviderResultErr
