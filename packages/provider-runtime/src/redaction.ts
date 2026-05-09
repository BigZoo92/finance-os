// PR17B — Provider redaction harness.
//
// Recursive, secret-safe redaction for provider payloads, error fields, and log fields.
// This is the single primitive every other provider-runtime module funnels through before
// emitting any observable artifact (logs, diagnostics, safe-JSON errors).
//
// Invariants this module MUST hold:
//  - Sensitive *keys* are redacted regardless of value type.
//  - Long strings are clamped so accidental payload echoes never blow up logs.
//  - Cycles produce '[Circular]', not a stack overflow.
//  - Errors / Dates / arrays are walked safely.
//  - Unknown / exotic objects (Map, Set, class instances) are stringified safely.
//  - The harness itself never throws on user input.

const REDACTED_VALUE = '[REDACTED]'
const CIRCULAR_VALUE = '[Circular]'
const DEFAULT_MAX_STRING_LENGTH = 1000

const DEFAULT_SENSITIVE_KEY_FRAGMENTS: ReadonlyArray<string> = [
  'token',
  'secret',
  'password',
  'passphrase',
  'apikey',
  'api_key',
  'authorization',
  'auth',
  'cookie',
  'session',
  'private',
  'refresh',
  'access_token',
  'refresh_token',
  'client_secret',
  'credential',
  'signature',
  'jwt',
  'bearer',
  'key',
]

export interface SensitiveKeyMatcher {
  readonly fragments: ReadonlyArray<string>
  readonly matches: (key: string) => boolean
}

export interface RedactionOptions {
  readonly maxStringLength?: number
  readonly matcher?: SensitiveKeyMatcher
}

export const createSensitiveKeyMatcher = (
  customKeys?: ReadonlyArray<string>
): SensitiveKeyMatcher => {
  const fragments = [
    ...DEFAULT_SENSITIVE_KEY_FRAGMENTS,
    ...(customKeys ?? []).map(k => k.toLowerCase()),
  ]
  return {
    fragments,
    matches: (key: string) => {
      const lower = key.toLowerCase()
      for (const fragment of fragments) {
        if (lower.includes(fragment)) {
          return true
        }
      }
      return false
    },
  }
}

const defaultMatcher = createSensitiveKeyMatcher()

const clampString = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) {
    return value
  }
  return `${value.slice(0, maxLength)}…[clamped:${value.length - maxLength}]`
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object') {
    return false
  }
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

interface RedactCtx {
  readonly maxStringLength: number
  readonly matcher: SensitiveKeyMatcher
  readonly seen: WeakSet<object>
}

const redactValue = (value: unknown, key: string | undefined, ctx: RedactCtx): unknown => {
  if (key !== undefined && ctx.matcher.matches(key)) {
    return REDACTED_VALUE
  }

  if (value === null || value === undefined) {
    return value
  }

  const t = typeof value
  if (t === 'string') {
    return clampString(value as string, ctx.maxStringLength)
  }
  if (t === 'number' || t === 'boolean') {
    return value
  }
  if (t === 'bigint') {
    return (value as bigint).toString()
  }
  if (t === 'symbol' || t === 'function') {
    return `[${t}]`
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (value instanceof Error) {
    if (ctx.seen.has(value)) {
      return CIRCULAR_VALUE
    }
    ctx.seen.add(value)
    return {
      name: value.name,
      message: clampString(value.message, ctx.maxStringLength),
    }
  }

  if (Array.isArray(value)) {
    if (ctx.seen.has(value)) {
      return CIRCULAR_VALUE
    }
    ctx.seen.add(value)
    return value.map(entry => redactValue(entry, undefined, ctx))
  }

  if (isPlainObject(value)) {
    if (ctx.seen.has(value)) {
      return CIRCULAR_VALUE
    }
    ctx.seen.add(value)
    const out: Record<string, unknown> = {}
    for (const [entryKey, entryValue] of Object.entries(value)) {
      out[entryKey] = redactValue(entryValue, entryKey, ctx)
    }
    return out
  }

  // Map / Set / class instance / TypedArray / etc. — never trust their toString.
  if (typeof value === 'object') {
    if (ctx.seen.has(value as object)) {
      return CIRCULAR_VALUE
    }
    ctx.seen.add(value as object)
    const ctor = (value as { constructor?: { name?: string } }).constructor?.name ?? 'Object'
    return `[${ctor}]`
  }

  return REDACTED_VALUE
}

export const redactProviderPayload = (value: unknown, options?: RedactionOptions): unknown => {
  const ctx: RedactCtx = {
    maxStringLength: options?.maxStringLength ?? DEFAULT_MAX_STRING_LENGTH,
    matcher: options?.matcher ?? defaultMatcher,
    seen: new WeakSet(),
  }
  return redactValue(value, undefined, ctx)
}

export const redactProviderLogFields = (
  fields: Record<string, unknown>,
  options?: RedactionOptions
): Record<string, unknown> => {
  const ctx: RedactCtx = {
    maxStringLength: options?.maxStringLength ?? DEFAULT_MAX_STRING_LENGTH,
    matcher: options?.matcher ?? defaultMatcher,
    seen: new WeakSet(),
  }
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(fields)) {
    out[key] = redactValue(value, key, ctx)
  }
  return out
}

export interface SensitiveFieldFinding {
  readonly path: string
  readonly key: string
}

const collectUnredactedSensitive = (
  value: unknown,
  matcher: SensitiveKeyMatcher,
  path: string,
  seen: WeakSet<object>,
  out: SensitiveFieldFinding[]
): void => {
  if (value === null || typeof value !== 'object') {
    return
  }
  if (seen.has(value as object)) {
    return
  }
  seen.add(value as object)

  if (Array.isArray(value)) {
    value.forEach((entry, idx) => {
      collectUnredactedSensitive(entry, matcher, `${path}[${idx}]`, seen, out)
    })
    return
  }
  if (isPlainObject(value)) {
    for (const [k, v] of Object.entries(value)) {
      const childPath = path === '' ? k : `${path}.${k}`
      if (matcher.matches(k) && v !== REDACTED_VALUE) {
        out.push({ path: childPath, key: k })
      }
      collectUnredactedSensitive(v, matcher, childPath, seen, out)
    }
  }
}

/**
 * Throws if any sensitive key in the structure carries a non-`[REDACTED]` value.
 * Use as `assertNoSensitiveProviderFields(redactProviderPayload(x))` to prove a payload
 * round-tripped through redaction left no secret-shaped values behind.
 */
export const assertNoSensitiveProviderFields = (
  value: unknown,
  options?: { matcher?: SensitiveKeyMatcher }
): void => {
  const matcher = options?.matcher ?? defaultMatcher
  const findings: SensitiveFieldFinding[] = []
  collectUnredactedSensitive(value, matcher, '', new WeakSet(), findings)
  if (findings.length > 0) {
    const summary = findings.map(f => f.path).join(', ')
    throw new Error(
      `assertNoSensitiveProviderFields: found unredacted sensitive fields at ${summary}`
    )
  }
}
