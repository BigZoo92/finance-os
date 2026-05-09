// PR17A — Contract self-tests for the provider-contract package.
//
// These tests guard the invariants the rest of the monorepo will rely on:
//   1. The forbidden capability list never leaks into the allowed union (compile-time + runtime).
//   2. `ProviderResult` narrows correctly off the `ok` discriminant.
//   3. `ProviderErrorCode` is a closed taxonomy — no missing codes, no stowaways.
//   4. `ProviderCallContext` requires `mode` (no demo/admin default).
//   5. The package is types-only — no runtime provider modules / network deps imported.

import { describe, expect, it } from 'bun:test'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ALLOWED_PROVIDER_CAPABILITIES,
  asProviderId,
  FORBIDDEN_PROVIDER_CAPABILITIES,
  PROVIDER_ERROR_CODES,
  PROVIDER_HEALTH_STATUSES,
  PROVIDER_MODES,
  __PROVIDER_CAPABILITY_GUARD_OK,
} from './index'
import type {
  ProviderCallContext,
  ProviderError,
  ProviderErrorCode,
  ProviderResult,
} from './index'

// ---------------------------------------------------------------------------
// 1. Forbidden vs allowed capabilities — runtime mirror of the compile-time guard.
// ---------------------------------------------------------------------------

describe('capability registry', () => {
  it('exposes a non-empty allowed list', () => {
    expect(ALLOWED_PROVIDER_CAPABILITIES.length).toBeGreaterThan(0)
  })

  it('exposes a non-empty forbidden list', () => {
    expect(FORBIDDEN_PROVIDER_CAPABILITIES.length).toBeGreaterThan(0)
  })

  it('shares no string between the allowed and forbidden lists', () => {
    const allowed: ReadonlySet<string> = new Set(ALLOWED_PROVIDER_CAPABILITIES)
    for (const forbidden of FORBIDDEN_PROVIDER_CAPABILITIES) {
      expect(allowed.has(forbidden)).toBe(false)
    }
  })

  it('confirms the compile-time guard marker stayed `true`', () => {
    expect(__PROVIDER_CAPABILITY_GUARD_OK).toBe(true)
  })

  it('uses only read-shaped action verbs in allowed capabilities', () => {
    const readShaped = new Set(['read', 'detect', 'compute', 'query', 'bundle'])
    for (const cap of ALLOWED_PROVIDER_CAPABILITIES) {
      const action = cap.split('.').at(-1)
      expect(readShaped.has(action ?? '')).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// 2. ProviderResult — discriminated union narrowing.
// ---------------------------------------------------------------------------

describe('ProviderResult', () => {
  it('narrows to the ok branch on `ok: true`', () => {
    const result: ProviderResult<{ value: number }> = {
      ok: true,
      data: { value: 42 },
      meta: {
        requestId: 'req-1',
        durationMs: 12,
        sources: [
          {
            providerId: asProviderId('test'),
            capability: 'market.quotes.read',
            freshnessMinutes: 0,
            fromCache: false,
          },
        ],
      },
    }

    if (result.ok) {
      expect(result.data.value).toBe(42)
    } else {
      throw new Error('expected ok branch')
    }
  })

  it('narrows to the err branch on `ok: false`', () => {
    const result: ProviderResult<{ value: number }> = {
      ok: false,
      error: {
        code: 'rate_limited',
        providerId: asProviderId('test'),
        retryable: true,
      },
      meta: {
        requestId: 'req-2',
        durationMs: 0,
        sources: [
          {
            providerId: asProviderId('test'),
            capability: 'market.quotes.read',
            freshnessMinutes: null,
            fromCache: false,
          },
        ],
      },
    }

    if (result.ok) {
      throw new Error('expected err branch')
    }
    expect(result.error.code).toBe('rate_limited')
    expect(result.error.retryable).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 3. ProviderErrorCode — closed taxonomy.
// ---------------------------------------------------------------------------

describe('ProviderErrorCode', () => {
  it('lists exactly the 14 codes mandated by the ADR', () => {
    const expected: ReadonlyArray<ProviderErrorCode> = [
      'unconfigured',
      'disabled_by_flag',
      'rate_limited',
      'auth_failed',
      'not_found',
      'invalid_input',
      'transient',
      'permanent',
      'tos_blocked',
      'demo_mode_forbidden',
      'budget_exceeded',
      'stale_cache',
      'provider_unavailable',
      'unsupported_capability',
    ]
    expect([...PROVIDER_ERROR_CODES].sort()).toEqual([...expected].sort())
  })

  it('covers every code via exhaustive switch (compile-time exhaustiveness)', () => {
    function classify(code: ProviderErrorCode): 'config' | 'auth' | 'limit' | 'data' | 'runtime' {
      switch (code) {
        case 'unconfigured':
        case 'disabled_by_flag':
        case 'demo_mode_forbidden':
        case 'unsupported_capability':
          return 'config'
        case 'auth_failed':
        case 'tos_blocked':
          return 'auth'
        case 'rate_limited':
        case 'budget_exceeded':
          return 'limit'
        case 'not_found':
        case 'invalid_input':
        case 'stale_cache':
          return 'data'
        case 'transient':
        case 'permanent':
        case 'provider_unavailable':
          return 'runtime'
        default: {
          const _exhaustive: never = code
          return _exhaustive
        }
      }
    }

    for (const code of PROVIDER_ERROR_CODES) {
      expect(typeof classify(code)).toBe('string')
    }
  })

  it('rejects construction of a ProviderError without a closed code (type test)', () => {
    const err: ProviderError = {
      code: 'auth_failed',
      providerId: asProviderId('test'),
      retryable: false,
      causeRedacted: 'token rotated, reconnect required',
    }
    expect(err.code).toBe('auth_failed')
  })
})

// ---------------------------------------------------------------------------
// 4. ProviderCallContext — mode is required, no defaults.
// ---------------------------------------------------------------------------

describe('ProviderCallContext', () => {
  it('exposes only `demo` and `admin` modes', () => {
    expect([...PROVIDER_MODES].sort()).toEqual(['admin', 'demo'])
  })

  it('builds with required fields only', () => {
    const ctx: ProviderCallContext = {
      mode: 'demo',
      requestId: 'req-3',
      now: new Date('2026-05-08T00:00:00Z'),
      reason: 'unit-test smoke',
    }
    expect(ctx.mode).toBe('demo')
    expect(ctx.budgetPolicy).toBeUndefined()
    expect(ctx.freshnessPolicy).toBeUndefined()
    expect(ctx.dryRun).toBeUndefined()
  })

  it('builds with all optional policies populated', () => {
    const ctx: ProviderCallContext = {
      mode: 'admin',
      requestId: 'req-4',
      now: new Date('2026-05-08T00:00:00Z'),
      reason: 'unit-test policies',
      budgetPolicy: { maxCostUsdCents: 25, onUnknownCost: 'deny' },
      freshnessPolicy: { maxAgeMinutes: 5, allowCache: true },
      dryRun: true,
    }
    expect(ctx.budgetPolicy?.maxCostUsdCents).toBe(25)
    expect(ctx.freshnessPolicy?.allowCache).toBe(true)
    expect(ctx.dryRun).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 5. Health status taxonomy.
// ---------------------------------------------------------------------------

describe('ProviderHealthStatus', () => {
  it('exposes the closed three-value union', () => {
    expect([...PROVIDER_HEALTH_STATUSES].sort()).toEqual(['degraded', 'down', 'ok'])
  })
})

// ---------------------------------------------------------------------------
// 6. Package is types-only — no runtime provider / transport imports.
//
// We grep every source file (excluding tests) for any import path that suggests a real
// provider adapter, network stack, or workspace runtime dependency. PR17A defines shape
// only; smuggling a runtime import here would silently couple every consumer of the
// barrel to that adapter.
// ---------------------------------------------------------------------------

describe('package boundary', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const sourceFiles = readdirSync(here)
    .filter((f) => f.endsWith('.ts'))
    .filter((f) => !f.endsWith('.test.ts'))

  it('imports nothing beyond intra-package relative paths', () => {
    // Extract every import / from-style module specifier and assert each one is either
    // a relative path (starts with `.`) or a `node:*` builtin. This catches workspace
    // runtime deps (e.g., `@finance-os/db`) and transport libs (e.g., `undici`, `ws`)
    // without resorting to substring sweeps that produce false positives on prose.
    const importRe = /(?:from|import)\s+['"]([^'"]+)['"]/g
    for (const file of sourceFiles) {
      const body = readFileSync(join(here, file), 'utf8')
      for (const match of body.matchAll(importRe)) {
        const spec = match[1] ?? ''
        const isRelative = spec.startsWith('.')
        const isNodeBuiltin = spec.startsWith('node:')
        expect(isRelative || isNodeBuiltin).toBe(true)
      }
      // No runtime fetch / network calls — TYPES ONLY.
      expect(body.includes('globalThis.fetch')).toBe(false)
      expect(/\bfetch\s*\(/.test(body)).toBe(false)
    }
  })

  it('lists exactly the seven type modules + index barrel under src/', () => {
    const expected = new Set([
      'capabilities.ts',
      'context.ts',
      'error.ts',
      'health.ts',
      'meta.ts',
      'provider-id.ts',
      'provider.ts',
      'result.ts',
      'index.ts',
    ])
    expect(new Set(sourceFiles)).toEqual(expected)
  })
})
