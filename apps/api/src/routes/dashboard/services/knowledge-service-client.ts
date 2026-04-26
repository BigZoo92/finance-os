import { logApiEvent, toErrorLogFields } from '../../../observability/logger'

export type KnowledgeRetrievalMode = 'hybrid' | 'graph' | 'vector' | 'fulltext'
export type KnowledgeScope = 'demo' | 'admin' | 'internal'

export interface KnowledgeServiceClientConfig {
  enabled: boolean
  url: string
  timeoutMs: number
  maxContextTokens: number
  retrievalMode: KnowledgeRetrievalMode
  maxPathDepth: number
  minConfidence: number
}

export interface KnowledgeQueryInput {
  query: string
  mode: KnowledgeScope
  filters?: Record<string, unknown>
  maxResults?: number
  maxPathDepth?: number
  retrievalMode?: KnowledgeRetrievalMode
  includeContradictions?: boolean
  includeEvidence?: boolean
}

export interface KnowledgeContextBundleInput extends KnowledgeQueryInput {
  maxTokens?: number
  advisorTask?: string
}

export interface KnowledgeRebuildInput {
  mode: KnowledgeScope
  includeSeed?: boolean
  sources?: string[]
  dryRun?: boolean
}

export interface KnowledgeExplainInput {
  id: string
  query?: string
  mode: KnowledgeScope
}

export class KnowledgeServiceUnavailableError extends Error {
  readonly code = 'KNOWLEDGE_SERVICE_UNAVAILABLE'

  constructor(
    message: string,
    readonly causeError?: unknown
  ) {
    super(message)
    this.name = 'KnowledgeServiceUnavailableError'
  }
}

const withDefined = <TKey extends string, TValue>(key: TKey, value: TValue | undefined) => {
  if (value === undefined) {
    return {}
  }

  return {
    [key]: value,
  } as { [K in TKey]?: TValue }
}

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '')

const createKnowledgeUrl = (baseUrl: string, path: string) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${normalizeBaseUrl(baseUrl)}${normalizedPath}`
}

const shouldRetry = ({
  method,
  path,
  status,
}: {
  method: string
  path: string
  status: number | 'network_error'
}) => {
  const safeReadPost =
    method === 'POST' &&
    (path === '/knowledge/query' ||
      path === '/knowledge/context-bundle' ||
      path === '/knowledge/explain')

  if (method !== 'GET' && !safeReadPost) {
    return false
  }

  return (
    status === 'network_error' ||
    status === 408 ||
    status === 429 ||
    (typeof status === 'number' && status >= 500)
  )
}

export const createKnowledgeServiceClient = (config: KnowledgeServiceClientConfig) => {
  const call = async <TResponse>(
    path: string,
    {
      method = 'GET',
      body,
      requestId,
    }: {
      method?: 'GET' | 'POST'
      body?: unknown
      requestId: string
    }
  ): Promise<TResponse> => {
    if (!config.enabled) {
      throw new KnowledgeServiceUnavailableError('Knowledge service is disabled by feature flag.')
    }

    const url = createKnowledgeUrl(config.url, path)
    const maxAttempts =
      method === 'GET' || shouldRetry({ method, path, status: 'network_error' }) ? 2 : 1
    let lastError: unknown

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), config.timeoutMs)

      try {
        const response = await fetch(url, {
          method,
          headers: {
            accept: 'application/json',
            'x-request-id': requestId,
            ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          signal: controller.signal,
        })

        if (!response.ok) {
          lastError = new KnowledgeServiceUnavailableError(
            `Knowledge service returned HTTP ${response.status}.`
          )
          logApiEvent({
            level: response.status >= 500 ? 'warn' : 'info',
            msg: 'knowledge service request returned non-ok status',
            requestId,
            status: response.status,
            route: path,
            attempt,
          })

          if (attempt < maxAttempts && shouldRetry({ method, path, status: response.status })) {
            continue
          }

          throw lastError
        }

        return (await response.json()) as TResponse
      } catch (error) {
        lastError = error
        if (attempt < maxAttempts && shouldRetry({ method, path, status: 'network_error' })) {
          logApiEvent({
            level: 'warn',
            msg: 'knowledge service request retrying',
            requestId,
            route: path,
            attempt,
            ...toErrorLogFields({ error, includeStack: false }),
          })
          continue
        }

        throw new KnowledgeServiceUnavailableError('Knowledge service request failed.', lastError)
      } finally {
        clearTimeout(timeout)
      }
    }

    throw new KnowledgeServiceUnavailableError('Knowledge service request failed.', lastError)
  }

  return {
    config,
    getStats: (requestId: string) =>
      call<Record<string, unknown>>('/knowledge/stats', { requestId }),
    getSchema: (requestId: string) =>
      call<Record<string, unknown>>('/knowledge/schema', { requestId }),
    query: (input: KnowledgeQueryInput, requestId: string) =>
      call<Record<string, unknown>>('/knowledge/query', {
        method: 'POST',
        requestId,
        body: {
          ...input,
          maxPathDepth: input.maxPathDepth ?? config.maxPathDepth,
          retrievalMode: input.retrievalMode ?? config.retrievalMode,
          filters: {
            minConfidence: config.minConfidence,
            ...(input.filters ?? {}),
          },
        },
      }),
    contextBundle: (input: KnowledgeContextBundleInput, requestId: string) =>
      call<Record<string, unknown>>('/knowledge/context-bundle', {
        method: 'POST',
        requestId,
        body: {
          ...input,
          maxTokens: input.maxTokens ?? config.maxContextTokens,
          maxPathDepth: input.maxPathDepth ?? config.maxPathDepth,
          retrievalMode: input.retrievalMode ?? config.retrievalMode,
          filters: {
            minConfidence: config.minConfidence,
            ...(input.filters ?? {}),
          },
        },
      }),
    rebuild: (input: KnowledgeRebuildInput, requestId: string) =>
      call<Record<string, unknown>>('/knowledge/rebuild', {
        method: 'POST',
        requestId,
        body: {
          mode: input.mode,
          includeSeed: input.includeSeed ?? true,
          ...(input.sources ? { sources: input.sources } : {}),
          ...(input.dryRun !== undefined ? { dryRun: input.dryRun } : {}),
        },
      }),
    explain: (input: KnowledgeExplainInput, requestId: string) =>
      call<Record<string, unknown>>('/knowledge/explain', {
        method: 'POST',
        requestId,
        body: {
          id: input.id,
          mode: input.mode,
          ...withDefined('query', input.query),
        },
      }),
  }
}
