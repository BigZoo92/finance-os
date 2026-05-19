/**
 * Public X (Twitter) profile lookup. Hits GET /2/users/by/username/:username
 * with the bearer token, returns a structured profile or a typed failure.
 *
 * Cost model (X Pay-Per-Use):
 *   1 successful call = 1 user read = $0.010
 * Callers MUST therefore cache the result (Redis 24h is enough) and persist the
 * `id` so subsequent timeline fetches don't pay the lookup again.
 *
 * Failure modes are explicit so the admin UI can show actionable errors:
 *   - TOKEN_MISSING / TOKEN_INVALID
 *   - PAYMENT_REQUIRED (402) → "credits required" path
 *   - RATE_LIMITED (429)
 *   - NOT_FOUND (404)
 *   - PROVIDER_UNAVAILABLE (5xx / network)
 */

export type XTwitterProfile = {
  id: string
  username: string
  name: string
  description: string | null
  profileImageUrl: string | null
  profileBannerUrl: string | null
  verified: boolean
  verifiedType: 'blue' | 'business' | 'government' | null
  protected: boolean
  publicMetrics: {
    followersCount: number | null
    followingCount: number | null
    tweetCount: number | null
    listedCount: number | null
  }
  createdAt: string | null
  fetchedAt: string
}

export type XTwitterProfileOutcome =
  | { ok: true; profile: XTwitterProfile; userReads: number; estimatedCostUsd: number }
  | {
      ok: false
      code:
        | 'TOKEN_MISSING'
        | 'TOKEN_INVALID'
        | 'PAYMENT_REQUIRED'
        | 'FORBIDDEN'
        | 'RATE_LIMITED'
        | 'NOT_FOUND'
        | 'PROVIDER_UNAVAILABLE'
        | 'NETWORK_ERROR'
        | 'INVALID_HANDLE'
      message: string
      statusCode: number | null
      userReads: number
      estimatedCostUsd: number
    }

const USER_READ_COST_USD = 0.01

const HANDLE_PATTERN = /^[a-z0-9_]{1,15}$/
const SUPPORTED_X_HOSTS = new Set([
  'x.com',
  'twitter.com',
  'mobile.twitter.com',
  'm.twitter.com',
])

export type NormalizeXHandleResult =
  | { ok: true; handle: string }
  | { ok: false; code: 'INVALID_HANDLE'; reason: string }

/**
 * Normalize any user-supplied X / Twitter handle reference into a canonical
 * lowercase username (1–15 chars of `[a-z0-9_]`).
 *
 * Accepted inputs:
 *   - "@elonmusk", "elonmusk", "  ElonMusk  ", "elonmusk/"
 *   - "https://x.com/elonmusk", "http://twitter.com/elonmusk"
 *   - "https://x.com/elonmusk?lang=fr", "https://mobile.twitter.com/elonmusk/"
 *
 * Rejected with INVALID_HANDLE for everything else (URLs to unsupported
 * hosts, empty strings, status URLs like /elonmusk/status/123, handles longer
 * than 15 chars, handles containing invalid characters).
 *
 * Used by both the profile lookup route (admin manual lookup) and the
 * social-accounts persistence path so a single normalization contract holds
 * end-to-end.
 */
export const normalizeXHandle = (input: unknown): NormalizeXHandleResult => {
  if (typeof input !== 'string') {
    return { ok: false, code: 'INVALID_HANDLE', reason: 'Handle must be a string.' }
  }

  let raw = input.trim()
  if (raw.length === 0) {
    return { ok: false, code: 'INVALID_HANDLE', reason: 'Handle cannot be empty.' }
  }

  // URL form. Accept x.com and twitter.com variants only.
  if (/^https?:\/\//i.test(raw)) {
    let url: URL
    try {
      url = new URL(raw)
    } catch {
      return { ok: false, code: 'INVALID_HANDLE', reason: 'Invalid URL.' }
    }
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    if (!SUPPORTED_X_HOSTS.has(host)) {
      return {
        ok: false,
        code: 'INVALID_HANDLE',
        reason: `Unsupported host "${host}". Only x.com and twitter.com URLs are accepted.`,
      }
    }
    const segments = url.pathname.split('/').filter(Boolean)
    if (segments.length === 0) {
      return { ok: false, code: 'INVALID_HANDLE', reason: 'URL has no username path segment.' }
    }
    const candidate = segments[0]
    if (
      !candidate ||
      candidate === 'i' ||
      candidate === 'home' ||
      candidate === 'explore' ||
      candidate === 'search'
    ) {
      return { ok: false, code: 'INVALID_HANDLE', reason: 'URL does not point to a profile.' }
    }
    raw = candidate
  }

  // Strip a leading @, trailing slashes, and lowercase.
  const handle = raw
    .replace(/^@+/, '')
    .replace(/\/+$/, '')
    .trim()
    .toLowerCase()

  if (handle.length === 0) {
    return { ok: false, code: 'INVALID_HANDLE', reason: 'Handle cannot be empty after trimming.' }
  }

  if (!HANDLE_PATTERN.test(handle)) {
    return {
      ok: false,
      code: 'INVALID_HANDLE',
      reason: 'Handle must be 1–15 characters of [a-z0-9_] (case-insensitive).',
    }
  }

  return { ok: true, handle }
}

/** @deprecated Prefer {@link normalizeXHandle} — kept for backwards compat. */
const cleanHandle = (input: string) => {
  const result = normalizeXHandle(input)
  return result.ok ? result.handle : input.trim().replace(/^@/, '').toLowerCase()
}

const mapStatusToCode = (status: number): XTwitterProfileOutcome extends infer T
  ? T extends { code: infer C }
    ? C
    : never
  : never => {
  if (status === 401) return 'TOKEN_INVALID'
  if (status === 402) return 'PAYMENT_REQUIRED'
  if (status === 403) return 'FORBIDDEN'
  if (status === 404) return 'NOT_FOUND'
  if (status === 429) return 'RATE_LIMITED'
  if (status >= 500) return 'PROVIDER_UNAVAILABLE'
  return 'PROVIDER_UNAVAILABLE'
}

const profileFromResponse = (data: Record<string, unknown>): XTwitterProfile | null => {
  if (!data || typeof data !== 'object') return null
  const profile = (data as { data?: Record<string, unknown> }).data
  if (!profile || typeof profile !== 'object') return null
  const id = profile.id
  const username = profile.username
  const name = profile.name
  if (typeof id !== 'string' || typeof username !== 'string' || typeof name !== 'string') {
    return null
  }
  const publicMetrics = (profile.public_metrics ?? {}) as Record<string, unknown>
  const verifiedType = (profile.verified_type as string | undefined) ?? null
  return {
    id,
    username,
    name,
    description: typeof profile.description === 'string' ? profile.description : null,
    profileImageUrl:
      typeof profile.profile_image_url === 'string' ? profile.profile_image_url : null,
    profileBannerUrl:
      typeof profile.profile_banner_url === 'string' ? profile.profile_banner_url : null,
    verified: profile.verified === true,
    verifiedType:
      verifiedType === 'blue' || verifiedType === 'business' || verifiedType === 'government'
        ? verifiedType
        : null,
    protected: profile.protected === true,
    publicMetrics: {
      followersCount:
        typeof publicMetrics.followers_count === 'number' ? publicMetrics.followers_count : null,
      followingCount:
        typeof publicMetrics.following_count === 'number' ? publicMetrics.following_count : null,
      tweetCount: typeof publicMetrics.tweet_count === 'number' ? publicMetrics.tweet_count : null,
      listedCount:
        typeof publicMetrics.listed_count === 'number' ? publicMetrics.listed_count : null,
    },
    createdAt: typeof profile.created_at === 'string' ? profile.created_at : null,
    fetchedAt: new Date().toISOString(),
  }
}

export type XTwitterFetch = (input: { url: string; bearerToken: string }) => Promise<{
  status: number
  body: Record<string, unknown>
  /** Optional rate-limit headers surfaced for budget/health observability.
   *  None of these expose secrets. Drop any unknown headers. */
  rateLimit?: {
    limit: number | null
    remaining: number | null
    resetAt: number | null
  }
}>

/** Per-handle result from a batch `users/by?usernames=` call. */
export type XTwitterBatchLookupItem =
  | { ok: true; handle: string; canonicalHandle: string; profile: XTwitterProfile }
  | {
      ok: false
      handle: string
      canonicalHandle: string | null
      code:
        | 'INVALID_HANDLE'
        | 'NOT_FOUND'
        | 'TOKEN_MISSING'
        | 'TOKEN_INVALID'
        | 'PAYMENT_REQUIRED'
        | 'FORBIDDEN'
        | 'RATE_LIMITED'
        | 'PROVIDER_UNAVAILABLE'
        | 'NETWORK_ERROR'
      message: string
      statusCode: number | null
    }

export type XTwitterBatchLookupOutcome = {
  items: XTwitterBatchLookupItem[]
  /** Total user reads billed (one per RESOLVED handle returned by X — invalid
   *  handles are filtered out client-side before the call so they cost $0). */
  userReads: number
  estimatedCostUsd: number
  /** When provided by X, surfaced for budget/health dashboards. */
  rateLimit: {
    limit: number | null
    remaining: number | null
    resetAt: number | null
  } | null
  /** Top-level provider error when the BATCH call itself failed (e.g. 401,
   *  429). Per-item errors are reported via `items[].ok=false`. */
  providerError: {
    code: 'TOKEN_MISSING' | 'TOKEN_INVALID' | 'PAYMENT_REQUIRED' | 'FORBIDDEN' | 'RATE_LIMITED' | 'PROVIDER_UNAVAILABLE' | 'NETWORK_ERROR'
    message: string
    statusCode: number | null
  } | null
}

/** Hard cap from the X v2 `users/by?usernames=` endpoint. */
export const X_BATCH_MAX_USERNAMES = 100

const USER_FIELDS_QUERY =
  'description,profile_image_url,profile_banner_url,verified,verified_type,protected,public_metrics,created_at'

type ProviderErrorCode =
  | 'TOKEN_MISSING'
  | 'TOKEN_INVALID'
  | 'PAYMENT_REQUIRED'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'PROVIDER_UNAVAILABLE'
  | 'NETWORK_ERROR'

const mapBatchStatusToCode = (status: number): ProviderErrorCode => {
  if (status === 401) return 'TOKEN_INVALID'
  if (status === 402) return 'PAYMENT_REQUIRED'
  if (status === 403) return 'FORBIDDEN'
  if (status === 429) return 'RATE_LIMITED'
  if (status >= 500) return 'PROVIDER_UNAVAILABLE'
  return 'PROVIDER_UNAVAILABLE'
}

const buildBatchProfile = (raw: Record<string, unknown>): XTwitterProfile | null => {
  // The batch endpoint returns objects shaped like the single-lookup `data`
  // payload (no enclosing `data:` key per row). Reuse the helper by faking
  // the wrapping.
  return profileFromResponse({ data: raw })
}

export const createXTwitterProfileClient = ({
  bearerToken,
  fetcher,
  baseUrl = 'https://api.x.com/2',
}: {
  bearerToken: string | null | undefined
  fetcher: XTwitterFetch
  baseUrl?: string
}) => ({
  lookupHandle: async (rawHandle: string): Promise<XTwitterProfileOutcome> => {
    if (!bearerToken) {
      return {
        ok: false,
        code: 'TOKEN_MISSING',
        message: 'X bearer token is not configured.',
        statusCode: null,
        userReads: 0,
        estimatedCostUsd: 0,
      }
    }
    const normalized = normalizeXHandle(rawHandle)
    if (!normalized.ok) {
      return {
        ok: false,
        code: 'INVALID_HANDLE',
        message: normalized.reason,
        statusCode: null,
        userReads: 0,
        estimatedCostUsd: 0,
      }
    }
    const handle = normalized.handle
    const url = `${baseUrl}/users/by/username/${handle}?user.fields=description,profile_image_url,profile_banner_url,verified,verified_type,protected,public_metrics,created_at`

    let response: { status: number; body: Record<string, unknown> }
    try {
      response = await fetcher({ url, bearerToken })
    } catch (error) {
      return {
        ok: false,
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message.slice(0, 200) : 'network error',
        statusCode: null,
        userReads: 0,
        estimatedCostUsd: 0,
      }
    }

    if (response.status === 200) {
      const profile = profileFromResponse(response.body)
      if (!profile) {
        return {
          ok: false,
          code: 'PROVIDER_UNAVAILABLE',
          message: 'X returned 200 but the payload did not parse.',
          statusCode: 200,
          userReads: 1,
          estimatedCostUsd: USER_READ_COST_USD,
        }
      }
      return {
        ok: true,
        profile,
        userReads: 1,
        estimatedCostUsd: USER_READ_COST_USD,
      }
    }

    return {
      ok: false,
      code: mapStatusToCode(response.status),
      message: `X profile lookup failed with status ${response.status}.`,
      statusCode: response.status,
      // 4xx that didn't fail at the load-balancer level still counts as a user
      // read on most plans. Be conservative — charge the lookup unless it was
      // an outright network failure (handled above).
      userReads: response.status === 404 ? 0 : 1,
      estimatedCostUsd: response.status === 404 ? 0 : USER_READ_COST_USD,
    }
  },

  /**
   * Batch-resolve up to {@link X_BATCH_MAX_USERNAMES} handles in a single X
   * call via `GET /2/users/by?usernames=h1,h2,...`. Invalid handles are
   * filtered out client-side and never reach the network — each one comes
   * back as `{ ok:false, code:'INVALID_HANDLE' }` for free.
   *
   * Cost: 1 user read per RESOLVED handle returned. Handles not found by X
   * appear in the response's `errors[]` array and are reported as
   * `{ ok:false, code:'NOT_FOUND' }` at zero cost (X doesn't bill for those
   * on most plans — we mirror the single-lookup conservative accounting).
   */
  lookupHandlesBatch: async (rawHandles: string[]): Promise<XTwitterBatchLookupOutcome> => {
    const emptyOutcome = (
      providerErrorCode: ProviderErrorCode,
      message: string,
      statusCode: number | null
    ): XTwitterBatchLookupOutcome => ({
      items: rawHandles.map(handle => ({
        ok: false as const,
        handle,
        canonicalHandle: null,
        code: providerErrorCode,
        message,
        statusCode,
      })),
      userReads: 0,
      estimatedCostUsd: 0,
      rateLimit: null,
      providerError: { code: providerErrorCode, message, statusCode },
    })

    if (!bearerToken) {
      return emptyOutcome('TOKEN_MISSING', 'X bearer token is not configured.', null)
    }

    if (rawHandles.length === 0) {
      return {
        items: [],
        userReads: 0,
        estimatedCostUsd: 0,
        rateLimit: null,
        providerError: null,
      }
    }

    if (rawHandles.length > X_BATCH_MAX_USERNAMES) {
      throw new Error(
        `lookupHandlesBatch: X allows at most ${X_BATCH_MAX_USERNAMES} usernames per call (got ${rawHandles.length}). Split the input before calling.`
      )
    }

    // 1) Normalize and split into valid (to send) and invalid (to return).
    type Normalized = { raw: string; canonical: string }
    const validHandles: Normalized[] = []
    const invalidItems: XTwitterBatchLookupItem[] = []
    for (const raw of rawHandles) {
      const result = normalizeXHandle(raw)
      if (result.ok) {
        validHandles.push({ raw, canonical: result.handle })
      } else {
        invalidItems.push({
          ok: false,
          handle: raw,
          canonicalHandle: null,
          code: 'INVALID_HANDLE',
          message: result.reason,
          statusCode: null,
        })
      }
    }

    if (validHandles.length === 0) {
      return {
        items: invalidItems,
        userReads: 0,
        estimatedCostUsd: 0,
        rateLimit: null,
        providerError: null,
      }
    }

    // 2) Dedupe canonical handles so we never bill X twice for the same id.
    //    Preserve a mapping back to ALL the raw inputs that asked for that
    //    canonical handle so each caller gets an answer.
    const canonicalToRaws = new Map<string, string[]>()
    for (const { raw, canonical } of validHandles) {
      const existing = canonicalToRaws.get(canonical) ?? []
      existing.push(raw)
      canonicalToRaws.set(canonical, existing)
    }
    const uniqueCanonical = Array.from(canonicalToRaws.keys())

    const url = `${baseUrl}/users/by?usernames=${uniqueCanonical.join(',')}&user.fields=${USER_FIELDS_QUERY}`

    let response: Awaited<ReturnType<XTwitterFetch>>
    try {
      response = await fetcher({ url, bearerToken })
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 200) : 'network error'
      const networkOutcome = emptyOutcome('NETWORK_ERROR', message, null)
      // Invalid handles still cost nothing — surface them alongside the
      // network failure so the caller doesn't lose that signal.
      return {
        ...networkOutcome,
        items: [...invalidItems, ...networkOutcome.items],
      }
    }

    const rateLimit = response.rateLimit ?? null

    if (response.status !== 200) {
      // Treat anything non-200 as a batch-wide provider failure. Even when
      // X returns a partial 200 with `errors[]`, that is success at the
      // HTTP level — we handle it in the `else` branch below.
      const code = mapBatchStatusToCode(response.status)
      const message = `X batch lookup failed with status ${response.status}.`
      const providerErrorItems: XTwitterBatchLookupItem[] = validHandles.map(v => ({
        ok: false,
        handle: v.raw,
        canonicalHandle: v.canonical,
        code,
        message,
        statusCode: response.status,
      }))
      return {
        items: [...invalidItems, ...providerErrorItems],
        // 401/403/429 don't return data → don't charge. 404 doesn't apply
        // here (the endpoint always returns 200 with errors[] for unknown
        // handles).
        userReads: 0,
        estimatedCostUsd: 0,
        rateLimit,
        providerError: { code, message, statusCode: response.status },
      }
    }

    // 3) Parse `data[]` (resolved users) and `errors[]` (per-handle errors).
    const payload = response.body as {
      data?: Array<Record<string, unknown>>
      errors?: Array<Record<string, unknown>>
    }
    const resolvedItems: XTwitterBatchLookupItem[] = []
    const resolvedCanonicals = new Set<string>()
    for (const raw of payload.data ?? []) {
      const profile = buildBatchProfile(raw)
      if (!profile) continue
      const canonical = profile.username.toLowerCase()
      resolvedCanonicals.add(canonical)
      // X returns the canonical username; the user might have asked for it
      // with different casing or via a redirected handle. Emit one
      // resolved-item per raw input that asked for this canonical.
      const requesters = canonicalToRaws.get(canonical) ?? [canonical]
      for (const requester of requesters) {
        resolvedItems.push({
          ok: true,
          handle: requester,
          canonicalHandle: canonical,
          profile,
        })
      }
    }

    // Handles in `errors[]` (typed objects with `.value` + `.title`) and any
    // canonical we asked for that's missing from both data[] and errors[].
    const notFoundCanonicals = new Set<string>()
    for (const err of payload.errors ?? []) {
      const value =
        typeof err.value === 'string' ? err.value.toLowerCase() : null
      if (value) notFoundCanonicals.add(value)
    }
    const notFoundItems: XTwitterBatchLookupItem[] = []
    for (const canonical of uniqueCanonical) {
      if (resolvedCanonicals.has(canonical)) continue
      const requesters = canonicalToRaws.get(canonical) ?? [canonical]
      const code: 'NOT_FOUND' = 'NOT_FOUND'
      for (const requester of requesters) {
        notFoundItems.push({
          ok: false,
          handle: requester,
          canonicalHandle: canonical,
          code,
          message: notFoundCanonicals.has(canonical)
            ? `X has no user with username "${canonical}".`
            : `X did not return a record for "${canonical}".`,
          statusCode: 200,
        })
      }
    }

    const userReads = resolvedCanonicals.size
    return {
      items: [...invalidItems, ...resolvedItems, ...notFoundItems],
      userReads,
      estimatedCostUsd: userReads * USER_READ_COST_USD,
      rateLimit,
      providerError: null,
    }
  },
})

export const __testing = { cleanHandle, profileFromResponse, normalizeXHandle }
