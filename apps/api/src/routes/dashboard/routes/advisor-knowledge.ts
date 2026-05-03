import { Elysia } from 'elysia'
import { getAuth, getInternalAuth, getRequestMeta } from '../../../auth/context'
import { requireAdminOrInternalToken } from '../../../auth/guard'
import { logApiEvent, toErrorLogFields } from '../../../observability/logger'
import {
  getDemoKnowledgeContextBundle,
  getDemoKnowledgeExplain,
  getDemoKnowledgeQuery,
  getDemoKnowledgeSchema,
  getDemoKnowledgeStats,
} from '../domain/advisor/knowledge-graph-demo'
import {
  buildAdminKnowledgeGraphDto,
  type KnowledgeBundleShape,
  type KnowledgeQueryShape,
} from '../domain/advisor/knowledge-graph-dto-admin'
import {
  buildDemoKnowledgeGraphDto,
  buildExampleOverlay,
} from '../domain/advisor/knowledge-graph-dto-demo'
import type {
  AdvisorKnowledgeGraphDto,
  AdvisorKnowledgeGraphScope,
} from '../domain/advisor/knowledge-graph-dto'
import { hardenGraphDto } from '../domain/advisor/knowledge-graph-dto'
import {
  dashboardAdvisorKnowledgeContextBundleBodySchema,
  dashboardAdvisorKnowledgeExplainBodySchema,
  dashboardAdvisorKnowledgeGraphQuerySchema,
  dashboardAdvisorKnowledgeQueryBodySchema,
  dashboardAdvisorKnowledgeRebuildBodySchema,
} from '../schemas'
import {
  createKnowledgeServiceClient,
  type KnowledgeContextBundleInput,
  type KnowledgeExplainInput,
  type KnowledgeQueryInput,
  type KnowledgeRebuildInput,
  type KnowledgeServiceClientConfig,
  KnowledgeServiceUnavailableError,
} from '../services/knowledge-service-client'

const buildKnowledgeRouteError = ({
  context,
  status,
  code,
  message,
}: {
  context: object & { set: { status?: number | string } }
  status: number
  code: string
  message: string
}) => {
  const requestId = getRequestMeta(context).requestId
  context.set.status = status
  return {
    ok: false,
    code,
    message,
    requestId,
  }
}

const ensureAdvisorAccess = ({
  context,
  advisorEnabled,
  adminOnly,
}: {
  context: object & { set: { status?: number | string } }
  advisorEnabled: boolean
  adminOnly: boolean
}) => {
  if (!advisorEnabled) {
    return buildKnowledgeRouteError({
      context,
      status: 503,
      code: 'ADVISOR_DISABLED',
      message: 'AI advisor is disabled by feature flag.',
    })
  }

  const auth = getAuth(context)
  const internalAuth = getInternalAuth(context)
  if (adminOnly && auth.mode !== 'admin' && !internalAuth.hasValidToken) {
    return buildKnowledgeRouteError({
      context,
      status: 403,
      code: 'ADVISOR_ADMIN_ONLY',
      message: 'AI advisor is restricted to admin sessions.',
    })
  }

  return null
}

const ensureAdminMutationAccess = ({
  context,
  message,
}: {
  context: object & { set: { status?: number | string } }
  message: string
}) => {
  try {
    requireAdminOrInternalToken(context)
    return null
  } catch {
    return buildKnowledgeRouteError({
      context,
      status: 403,
      code: 'DEMO_MODE_FORBIDDEN',
      message,
    })
  }
}

const withMode = <TInput extends { mode?: 'demo' | 'admin' | 'internal' }>(
  input: TInput,
  mode: 'demo' | 'admin'
) => ({
  ...input,
  mode,
})

const buildUnavailableFallback = ({
  requestId,
  message,
}: {
  requestId: string
  message: string
}) => ({
  ok: true,
  requestId,
  generatedAt: new Date().toISOString(),
  degraded: true,
  fallbackReason: 'knowledge_service_unavailable',
  message,
  hits: [],
  entities: [],
  relations: [],
  graphPaths: [],
  evidence: [],
  contradictoryEvidence: [],
  assumptions: [],
  unknowns: ['Knowledge service is unavailable; deterministic advisor output remains primary.'],
  retrievalExplanation: ['Fail-soft fallback from apps/api; no provider call was attempted.'],
  confidence: 0,
  recency: 0,
  tokenEstimate: 0,
})

export const createAdvisorKnowledgeRoute = ({
  advisorEnabled,
  adminOnly,
  knowledgeConfig,
}: {
  advisorEnabled: boolean
  adminOnly: boolean
  knowledgeConfig: KnowledgeServiceClientConfig
}) => {
  const client = createKnowledgeServiceClient(knowledgeConfig)

  const handleKnowledgeError = ({
    context,
    error,
    operation,
  }: {
    context: object & { set: { status?: number | string } }
    error: unknown
    operation: string
  }) => {
    const requestId = getRequestMeta(context).requestId
    logApiEvent({
      level: 'warn',
      msg: 'advisor knowledge service degraded',
      requestId,
      advisor_knowledge_operation: operation,
      ...toErrorLogFields({ error, includeStack: false }),
    })

    if (error instanceof KnowledgeServiceUnavailableError) {
      return buildUnavailableFallback({
        requestId,
        message: error.message,
      })
    }

    return buildUnavailableFallback({
      requestId,
      message: 'Knowledge service returned an unexpected safe error.',
    })
  }

  return new Elysia()
    .get('/advisor/knowledge/stats', async context => {
      const accessError = ensureAdvisorAccess({ context, advisorEnabled, adminOnly })
      if (accessError) return accessError

      const auth = getAuth(context)
      const requestId = getRequestMeta(context).requestId
      if (auth.mode === 'demo') {
        return getDemoKnowledgeStats(requestId)
      }

      try {
        return await client.getStats(requestId)
      } catch (error) {
        return {
          ...getDemoKnowledgeStats(requestId),
          degraded: true,
          fallbackReason: 'knowledge_service_unavailable',
          serviceMessage: handleKnowledgeError({ context, error, operation: 'stats' }).message,
        }
      }
    })
    .get('/advisor/knowledge/schema', async context => {
      const accessError = ensureAdvisorAccess({ context, advisorEnabled, adminOnly })
      if (accessError) return accessError

      const auth = getAuth(context)
      const requestId = getRequestMeta(context).requestId
      if (auth.mode === 'demo') {
        return getDemoKnowledgeSchema(requestId)
      }

      try {
        return await client.getSchema(requestId)
      } catch (error) {
        logApiEvent({
          level: 'warn',
          msg: 'advisor knowledge schema fallback',
          requestId,
          ...toErrorLogFields({ error, includeStack: false }),
        })
        return {
          ...getDemoKnowledgeSchema(requestId),
          degraded: true,
          fallbackReason: 'knowledge_service_unavailable',
        }
      }
    })
    .post(
      '/advisor/knowledge/query',
      async context => {
        const accessError = ensureAdvisorAccess({ context, advisorEnabled, adminOnly })
        if (accessError) return accessError

        const auth = getAuth(context)
        const requestId = getRequestMeta(context).requestId
        const input = withMode(context.body as KnowledgeQueryInput, auth.mode)
        if (auth.mode === 'demo') {
          return getDemoKnowledgeQuery(input, requestId)
        }

        try {
          return await client.query(input, requestId)
        } catch (error) {
          return handleKnowledgeError({ context, error, operation: 'query' })
        }
      },
      {
        body: dashboardAdvisorKnowledgeQueryBodySchema,
      }
    )
    .post(
      '/advisor/knowledge/context-bundle',
      async context => {
        const accessError = ensureAdvisorAccess({ context, advisorEnabled, adminOnly })
        if (accessError) return accessError

        const auth = getAuth(context)
        const requestId = getRequestMeta(context).requestId
        const input = withMode(context.body as KnowledgeContextBundleInput, auth.mode)
        if (auth.mode === 'demo') {
          return getDemoKnowledgeContextBundle(input, requestId)
        }

        try {
          return await client.contextBundle(input, requestId)
        } catch (error) {
          return handleKnowledgeError({ context, error, operation: 'context-bundle' })
        }
      },
      {
        body: dashboardAdvisorKnowledgeContextBundleBodySchema,
      }
    )
    .post(
      '/advisor/knowledge/explain',
      async context => {
        const accessError = ensureAdvisorAccess({ context, advisorEnabled, adminOnly })
        if (accessError) return accessError

        const auth = getAuth(context)
        const requestId = getRequestMeta(context).requestId
        const input = withMode(context.body as KnowledgeExplainInput, auth.mode)
        if (auth.mode === 'demo') {
          return getDemoKnowledgeExplain(input, requestId)
        }

        try {
          return await client.explain(input, requestId)
        } catch (error) {
          return handleKnowledgeError({ context, error, operation: 'explain' })
        }
      },
      {
        body: dashboardAdvisorKnowledgeExplainBodySchema,
      }
    )
    .post(
      '/advisor/knowledge/rebuild',
      async context => {
        const accessError = ensureAdvisorAccess({ context, advisorEnabled, adminOnly })
        if (accessError) return accessError

        const adminError = ensureAdminMutationAccess({
          context,
          message: 'Admin session or internal token required for knowledge graph rebuild.',
        })
        if (adminError) return adminError

        const requestId = getRequestMeta(context).requestId
        try {
          return await client.rebuild(
            {
              ...(context.body as KnowledgeRebuildInput),
              mode: 'admin',
            },
            requestId
          )
        } catch (error) {
          logApiEvent({
            level: 'warn',
            msg: 'advisor knowledge rebuild unavailable',
            requestId,
            ...toErrorLogFields({ error, includeStack: false }),
          })
          return buildKnowledgeRouteError({
            context,
            status: 503,
            code: 'KNOWLEDGE_SERVICE_UNAVAILABLE',
            message: 'Knowledge service unavailable; rebuild was not started.',
          })
        }
      },
      {
        body: dashboardAdvisorKnowledgeRebuildBodySchema,
      }
    )
    .get(
      '/advisor/knowledge/graph',
      async context => {
        const accessError = ensureAdvisorAccess({ context, advisorEnabled, adminOnly })
        if (accessError) return accessError

        const auth = getAuth(context)
        const requestId = getRequestMeta(context).requestId
        const query = context.query as {
          scope?: AdvisorKnowledgeGraphScope
          limit?: number
          includeExamples?: boolean
        }
        const scope: AdvisorKnowledgeGraphScope = query.scope ?? 'overview'
        const limit = Math.min(1000, Math.max(1, query.limit ?? 500))
        const includeExamples = query.includeExamples === true
        const generatedAt = new Date().toISOString()

        if (auth.mode === 'demo') {
          return buildDemoKnowledgeGraphDto({ scope, limit })
        }

        // Admin: pull bundle + query from the knowledge service. Both are
        // read-only fetches; failures degrade to an empty DTO with a reason.
        let bundle: KnowledgeBundleShape | undefined
        let queryResp: KnowledgeQueryShape | undefined
        let serviceFailed = false
        try {
          const baseQuery = 'advisor knowledge graph overview'
          const bundleInput: KnowledgeContextBundleInput = {
            query: baseQuery,
            mode: 'admin',
            retrievalMode: 'hybrid',
            maxResults: Math.min(64, limit),
            maxPathDepth: 3,
            maxTokens: 1800,
            includeContradictions: true,
            includeEvidence: true,
          }
          const queryInput: KnowledgeQueryInput = {
            query: baseQuery,
            mode: 'admin',
            retrievalMode: 'hybrid',
            maxResults: Math.min(64, limit),
            maxPathDepth: 3,
            includeContradictions: true,
            includeEvidence: true,
          }
          const [bundleRes, queryRes] = await Promise.allSettled([
            client.contextBundle(bundleInput, requestId),
            client.query(queryInput, requestId),
          ])
          if (bundleRes.status === 'fulfilled') bundle = bundleRes.value as KnowledgeBundleShape
          else serviceFailed = true
          if (queryRes.status === 'fulfilled') queryResp = queryRes.value as KnowledgeQueryShape
          else serviceFailed = true
        } catch (error) {
          logApiEvent({
            level: 'warn',
            msg: 'advisor knowledge graph fallback',
            requestId,
            ...toErrorLogFields({ error, includeStack: false }),
          })
          serviceFailed = true
        }

        let dto: AdvisorKnowledgeGraphDto = buildAdminKnowledgeGraphDto({
          scope,
          limit,
          generatedAt,
          ...(bundle ? { bundle } : {}),
          ...(queryResp ? { query: queryResp } : {}),
        })

        if (serviceFailed && dto.meta.origin === 'empty') {
          dto = {
            ...dto,
            meta: {
              ...dto.meta,
              origin: 'degraded',
              degraded: true,
              reason: 'Knowledge service unavailable; deterministic finance-engine remains primary.',
              source: 'fallback',
            },
          }
        }

        if (includeExamples) {
          const overlay = buildExampleOverlay(scope, limit)
          const merged = hardenGraphDto({
            nodes: [...dto.nodes, ...overlay.nodes],
            links: [...dto.links, ...overlay.links],
            meta: {
              ...dto.meta,
              origin: 'mixed',
              source: dto.meta.source ?? 'advisor-artifacts',
              reason:
                dto.nodes.length > 0
                  ? 'Réel + exemples curés. Les nœuds exemples sont marqués origin="example".'
                  : 'Aperçu enrichi avec exemples curés (mémoire réelle vide).',
            },
          })
          return merged
        }

        return dto
      },
      {
        query: dashboardAdvisorKnowledgeGraphQuerySchema,
      }
    )
}
