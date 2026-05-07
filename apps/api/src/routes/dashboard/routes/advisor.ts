import { Elysia } from 'elysia'
import { getAuth, getInternalAuth, getRequestMeta } from '../../../auth/context'
import { requireAdmin, requireAdminOrInternalToken } from '../../../auth/guard'
import { logApiEvent } from '../../../observability/logger'
import { getDashboardRuntime } from '../context'
import { isDecisionJournalValidationError } from '../domain/advisor/create-decision-journal-use-cases'
import {
  dashboardAdvisorChatBodySchema,
  dashboardAdvisorChatQuerySchema,
  dashboardAdvisorDecisionOutcomeCreateBodySchema,
  dashboardAdvisorJournalCreateBodySchema,
  dashboardAdvisorJournalListQuerySchema,
  dashboardAdvisorJournalParamsSchema,
  dashboardAdvisorKnowledgeAnswerQuerySchema,
  dashboardAdvisorListQuerySchema,
  dashboardAdvisorManualOperationParamsSchema,
  dashboardAdvisorPostMortemParamsSchema,
  dashboardAdvisorRunBodySchema,
  dashboardSummaryQuerySchema,
} from '../schemas'

const buildAdvisorRouteError = ({
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
    return buildAdvisorRouteError({
      context,
      status: 503,
      code: 'ADVISOR_DISABLED',
      message: 'AI advisor is disabled by feature flag.',
    })
  }

  const auth = getAuth(context)
  const internalAuth = getInternalAuth(context)
  if (adminOnly && auth.mode !== 'admin' && !internalAuth.hasValidToken) {
    return buildAdvisorRouteError({
      context,
      status: 403,
      code: 'ADVISOR_ADMIN_ONLY',
      message: 'AI advisor is restricted to admin sessions.',
    })
  }

  return null
}

const ensureFeatureEnabled = ({
  context,
  enabled,
  code,
  message,
}: {
  context: object & { set: { status?: number | string } }
  enabled: boolean
  code: string
  message: string
}) => {
  if (enabled) {
    return null
  }

  return buildAdvisorRouteError({
    context,
    status: 503,
    code,
    message,
  })
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
    return buildAdvisorRouteError({
      context,
      status: 403,
      code: 'DEMO_MODE_FORBIDDEN',
      message,
    })
  }
}

const ensureAdminSessionOnly = ({
  context,
  message,
}: {
  context: object & { set: { status?: number | string } }
  message: string
}) => {
  try {
    requireAdmin(context)
    return null
  } catch {
    return buildAdvisorRouteError({
      context,
      status: 403,
      code: 'DEMO_MODE_FORBIDDEN',
      message,
    })
  }
}

const buildJsonNullResponse = () =>
  new Response('null', {
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
  })

export const createAdvisorRoute = ({
  advisorEnabled,
  adminOnly,
  chatEnabled,
  relabelEnabled,
}: {
  advisorEnabled: boolean
  adminOnly: boolean
  chatEnabled: boolean
  relabelEnabled: boolean
} = {
  advisorEnabled: true,
  adminOnly: false,
  chatEnabled: true,
  relabelEnabled: true,
}) =>
  new Elysia()
    .get(
      '/advisor',
      async context => {
        const accessError = ensureAdvisorAccess({
          context,
          advisorEnabled,
          adminOnly,
        })
        if (accessError) {
          return accessError
        }

        const dashboard = getDashboardRuntime(context)
        if (!dashboard.useCases.getAdvisorOverview) {
          return buildAdvisorRouteError({
            context,
            status: 503,
            code: 'ADVISOR_RUNTIME_UNAVAILABLE',
            message: 'Advisor runtime is unavailable.',
          })
        }

        const auth = getAuth(context)
        const requestMeta = getRequestMeta(context)
        return dashboard.useCases.getAdvisorOverview({
          mode: auth.mode,
          requestId: requestMeta.requestId,
        })
      },
      {
        query: dashboardSummaryQuerySchema,
      }
    )
    .get('/advisor/daily-brief', async context => {
      const accessError = ensureAdvisorAccess({
        context,
        advisorEnabled,
        adminOnly,
      })
      if (accessError) {
        return accessError
      }

      const dashboard = getDashboardRuntime(context)
      if (!dashboard.useCases.getAdvisorDailyBrief) {
        return buildAdvisorRouteError({
          context,
          status: 503,
          code: 'ADVISOR_RUNTIME_UNAVAILABLE',
          message: 'Advisor daily brief runtime is unavailable.',
        })
      }

      const auth = getAuth(context)
      const requestMeta = getRequestMeta(context)
      return dashboard.useCases.getAdvisorDailyBrief({
        mode: auth.mode,
        requestId: requestMeta.requestId,
      })
    })
    .get(
      '/advisor/recommendations',
      async context => {
        const accessError = ensureAdvisorAccess({
          context,
          advisorEnabled,
          adminOnly,
        })
        if (accessError) {
          return accessError
        }

        const dashboard = getDashboardRuntime(context)
        if (!dashboard.useCases.getAdvisorRecommendations) {
          return buildAdvisorRouteError({
            context,
            status: 503,
            code: 'ADVISOR_RUNTIME_UNAVAILABLE',
            message: 'Advisor recommendations runtime is unavailable.',
          })
        }

        const auth = getAuth(context)
        const requestMeta = getRequestMeta(context)
        return dashboard.useCases.getAdvisorRecommendations({
          mode: auth.mode,
          requestId: requestMeta.requestId,
          ...(context.query.limit !== undefined ? { limit: context.query.limit } : {}),
        })
      },
      {
        query: dashboardAdvisorListQuerySchema,
      }
    )
    .get(
      '/advisor/runs',
      async context => {
        const accessError = ensureAdvisorAccess({
          context,
          advisorEnabled,
          adminOnly,
        })
        if (accessError) {
          return accessError
        }

        const dashboard = getDashboardRuntime(context)
        if (!dashboard.useCases.getAdvisorRuns) {
          return buildAdvisorRouteError({
            context,
            status: 503,
            code: 'ADVISOR_RUNTIME_UNAVAILABLE',
            message: 'Advisor run history runtime is unavailable.',
          })
        }

        const auth = getAuth(context)
        const requestMeta = getRequestMeta(context)
        return dashboard.useCases.getAdvisorRuns({
          mode: auth.mode,
          requestId: requestMeta.requestId,
          ...(context.query.limit !== undefined ? { limit: context.query.limit } : {}),
        })
      },
      {
        query: dashboardAdvisorListQuerySchema,
      }
    )
    .get(
      '/advisor/assumptions',
      async context => {
        const accessError = ensureAdvisorAccess({
          context,
          advisorEnabled,
          adminOnly,
        })
        if (accessError) {
          return accessError
        }

        const dashboard = getDashboardRuntime(context)
        if (!dashboard.useCases.getAdvisorAssumptions) {
          return buildAdvisorRouteError({
            context,
            status: 503,
            code: 'ADVISOR_RUNTIME_UNAVAILABLE',
            message: 'Advisor assumptions runtime is unavailable.',
          })
        }

        const auth = getAuth(context)
        const requestMeta = getRequestMeta(context)
        return dashboard.useCases.getAdvisorAssumptions({
          mode: auth.mode,
          requestId: requestMeta.requestId,
          ...(context.query.limit !== undefined ? { limit: context.query.limit } : {}),
        })
      },
      {
        query: dashboardAdvisorListQuerySchema,
      }
    )
    .get(
      '/advisor/signals',
      async context => {
        const accessError = ensureAdvisorAccess({
          context,
          advisorEnabled,
          adminOnly,
        })
        if (accessError) {
          return accessError
        }

        const dashboard = getDashboardRuntime(context)
        if (!dashboard.useCases.getAdvisorSignals) {
          return buildAdvisorRouteError({
            context,
            status: 503,
            code: 'ADVISOR_RUNTIME_UNAVAILABLE',
            message: 'Advisor signals runtime is unavailable.',
          })
        }

        const auth = getAuth(context)
        const requestMeta = getRequestMeta(context)
        return dashboard.useCases.getAdvisorSignals({
          mode: auth.mode,
          requestId: requestMeta.requestId,
          ...(context.query.limit !== undefined ? { limit: context.query.limit } : {}),
        })
      },
      {
        query: dashboardAdvisorListQuerySchema,
      }
    )
    .get('/advisor/spend', async context => {
      const accessError = ensureAdvisorAccess({
        context,
        advisorEnabled,
        adminOnly,
      })
      if (accessError) {
        return accessError
      }

      const dashboard = getDashboardRuntime(context)
      if (!dashboard.useCases.getAdvisorSpend) {
        return buildAdvisorRouteError({
          context,
          status: 503,
          code: 'ADVISOR_RUNTIME_UNAVAILABLE',
          message: 'Advisor spend runtime is unavailable.',
        })
      }

      const auth = getAuth(context)
      const requestMeta = getRequestMeta(context)
      return dashboard.useCases.getAdvisorSpend({
        mode: auth.mode,
        requestId: requestMeta.requestId,
      })
    })
    .get('/advisor/knowledge-topics', async context => {
      const accessError = ensureAdvisorAccess({
        context,
        advisorEnabled,
        adminOnly,
      })
      if (accessError) {
        return accessError
      }

      const dashboard = getDashboardRuntime(context)
      if (!dashboard.useCases.getAdvisorKnowledgeTopics) {
        return buildAdvisorRouteError({
          context,
          status: 503,
          code: 'ADVISOR_RUNTIME_UNAVAILABLE',
          message: 'Advisor knowledge topics runtime is unavailable.',
        })
      }

      const auth = getAuth(context)
      const requestMeta = getRequestMeta(context)
      return dashboard.useCases.getAdvisorKnowledgeTopics({
        mode: auth.mode,
        requestId: requestMeta.requestId,
      })
    })
    .get(
      '/advisor/knowledge-answer',
      async context => {
        const accessError = ensureAdvisorAccess({
          context,
          advisorEnabled,
          adminOnly,
        })
        if (accessError) {
          return accessError
        }

        const dashboard = getDashboardRuntime(context)
        if (!dashboard.useCases.getAdvisorKnowledgeAnswer) {
          return buildAdvisorRouteError({
            context,
            status: 503,
            code: 'ADVISOR_RUNTIME_UNAVAILABLE',
            message: 'Advisor knowledge answer runtime is unavailable.',
          })
        }

        const auth = getAuth(context)
        const requestMeta = getRequestMeta(context)
        const response = await dashboard.useCases.getAdvisorKnowledgeAnswer({
          mode: auth.mode,
          requestId: requestMeta.requestId,
          question: context.query.question,
        })

        logApiEvent({
          level: response.status === 'answered' ? 'info' : 'warn',
          msg: 'advisor knowledge answer',
          requestId: requestMeta.requestId,
          mode: auth.mode,
          advisor_knowledge_status: response.status,
          advisor_knowledge_source: response.source,
          advisor_knowledge_retrieval_enabled: response.retrievalEnabled,
          advisor_knowledge_low_confidence: response.lowConfidence,
          advisor_knowledge_fallback_reason: response.fallbackReason,
          advisor_knowledge_confidence_score: response.confidenceScore,
          advisor_knowledge_confidence_label: response.confidenceLabel,
          advisor_knowledge_intent: response.retrieval.intent,
          advisor_knowledge_hit_count: response.retrieval.hitCount,
          advisor_knowledge_matched_topic_ids: response.retrieval.matchedTopicIds,
          advisor_knowledge_guardrail_triggered: response.retrieval.guardrailTriggered,
          advisor_knowledge_latency_query_parse_ms:
            response.retrieval.stageLatenciesMs.queryParse,
          advisor_knowledge_latency_retrieval_ms:
            response.retrieval.stageLatenciesMs.retrieval,
          advisor_knowledge_latency_answer_assembly_ms:
            response.retrieval.stageLatenciesMs.answerAssembly,
          advisor_knowledge_latency_total_ms: response.retrieval.stageLatenciesMs.total,
          advisor_knowledge_question_length: context.query.question.trim().length,
        })

        return response
      },
      {
        query: dashboardAdvisorKnowledgeAnswerQuerySchema,
      }
    )
    .get('/advisor/manual-refresh-and-run', async context => {
      const accessError = ensureAdvisorAccess({
        context,
        advisorEnabled,
        adminOnly,
      })
      if (accessError) {
        return accessError
      }

      const adminError = ensureAdminMutationAccess({
        context,
        message: 'Admin session or internal token required for manual advisor orchestration.',
      })
      if (adminError) {
        return adminError
      }

      const dashboard = getDashboardRuntime(context)
      if (!dashboard.useCases.getLatestAdvisorManualOperation) {
        return buildAdvisorRouteError({
          context,
          status: 503,
          code: 'ADVISOR_RUNTIME_UNAVAILABLE',
          message: 'Advisor manual orchestration runtime is unavailable.',
        })
      }

      const auth = getAuth(context)
      const requestMeta = getRequestMeta(context)
      const operation = await dashboard.useCases.getLatestAdvisorManualOperation({
        mode: auth.mode,
        requestId: requestMeta.requestId,
      })

      return operation ?? buildJsonNullResponse()
    })
    .get(
      '/advisor/manual-refresh-and-run/:operationId',
      async context => {
        const accessError = ensureAdvisorAccess({
          context,
          advisorEnabled,
          adminOnly,
        })
        if (accessError) {
          return accessError
        }

        const adminError = ensureAdminMutationAccess({
          context,
          message: 'Admin session or internal token required for manual advisor orchestration.',
        })
        if (adminError) {
          return adminError
        }

        const dashboard = getDashboardRuntime(context)
        if (!dashboard.useCases.getAdvisorManualOperationById) {
          return buildAdvisorRouteError({
            context,
            status: 503,
            code: 'ADVISOR_RUNTIME_UNAVAILABLE',
            message: 'Advisor manual orchestration runtime is unavailable.',
          })
        }

        const auth = getAuth(context)
        const requestMeta = getRequestMeta(context)
        const operation = await dashboard.useCases.getAdvisorManualOperationById({
          mode: auth.mode,
          requestId: requestMeta.requestId,
          operationId: context.params.operationId,
        })

        if (!operation) {
          return buildAdvisorRouteError({
            context,
            status: 404,
            code: 'ADVISOR_MANUAL_OPERATION_NOT_FOUND',
            message: 'Advisor manual operation not found.',
          })
        }

        return operation
      },
      {
        params: dashboardAdvisorManualOperationParamsSchema,
      }
    )
    .post(
      '/advisor/manual-refresh-and-run',
      async context => {
        const accessError = ensureAdvisorAccess({
          context,
          advisorEnabled,
          adminOnly,
        })
        if (accessError) {
          return accessError
        }

        const adminError = ensureAdminMutationAccess({
          context,
          message: 'Admin session or internal token required for manual advisor orchestration.',
        })
        if (adminError) {
          return adminError
        }

        const dashboard = getDashboardRuntime(context)
        if (!dashboard.useCases.runAdvisorManualRefreshAndAnalysis) {
          return buildAdvisorRouteError({
            context,
            status: 503,
            code: 'ADVISOR_RUNTIME_UNAVAILABLE',
            message: 'Advisor manual orchestration runtime is unavailable.',
          })
        }

        const auth = getAuth(context)
        const requestMeta = getRequestMeta(context)
        return dashboard.useCases.runAdvisorManualRefreshAndAnalysis({
          mode: auth.mode,
          requestId: requestMeta.requestId,
          triggerSource: 'manual',
        })
      }
    )
    .get(
      '/advisor/chat',
      async context => {
        const accessError = ensureAdvisorAccess({
          context,
          advisorEnabled,
          adminOnly,
        })
        if (accessError) {
          return accessError
        }

        const chatError = ensureFeatureEnabled({
          context,
          enabled: chatEnabled,
          code: 'ADVISOR_CHAT_DISABLED',
          message: 'Advisor chat is disabled by feature flag.',
        })
        if (chatError) {
          return chatError
        }

        const dashboard = getDashboardRuntime(context)
        if (!dashboard.useCases.getAdvisorChat) {
          return buildAdvisorRouteError({
            context,
            status: 503,
            code: 'ADVISOR_RUNTIME_UNAVAILABLE',
            message: 'Advisor chat runtime is unavailable.',
          })
        }

        const auth = getAuth(context)
        const requestMeta = getRequestMeta(context)
        return dashboard.useCases.getAdvisorChat({
          mode: auth.mode,
          requestId: requestMeta.requestId,
          ...(context.query.threadKey ? { threadKey: context.query.threadKey } : {}),
        })
      },
      {
        query: dashboardAdvisorChatQuerySchema,
      }
    )
    .post(
      '/advisor/chat',
      async context => {
        const accessError = ensureAdvisorAccess({
          context,
          advisorEnabled,
          adminOnly,
        })
        if (accessError) {
          return accessError
        }

        const chatError = ensureFeatureEnabled({
          context,
          enabled: chatEnabled,
          code: 'ADVISOR_CHAT_DISABLED',
          message: 'Advisor chat is disabled by feature flag.',
        })
        if (chatError) {
          return chatError
        }

        const dashboard = getDashboardRuntime(context)
        if (!dashboard.useCases.postAdvisorChat) {
          return buildAdvisorRouteError({
            context,
            status: 503,
            code: 'ADVISOR_RUNTIME_UNAVAILABLE',
            message: 'Advisor chat runtime is unavailable.',
          })
        }

        const auth = getAuth(context)
        const requestMeta = getRequestMeta(context)
        return dashboard.useCases.postAdvisorChat({
          mode: auth.mode,
          requestId: requestMeta.requestId,
          ...(context.body.threadKey ? { threadKey: context.body.threadKey } : {}),
          message: context.body.message,
        })
      },
      {
        body: dashboardAdvisorChatBodySchema,
      }
    )
    .get('/advisor/evals', async context => {
      const accessError = ensureAdvisorAccess({
        context,
        advisorEnabled,
        adminOnly,
      })
      if (accessError) {
        return accessError
      }

      const dashboard = getDashboardRuntime(context)
      if (!dashboard.useCases.getAdvisorEvals) {
        return buildAdvisorRouteError({
          context,
          status: 503,
          code: 'ADVISOR_RUNTIME_UNAVAILABLE',
          message: 'Advisor eval runtime is unavailable.',
        })
      }

      const auth = getAuth(context)
      const requestMeta = getRequestMeta(context)
      return dashboard.useCases.getAdvisorEvals({
        mode: auth.mode,
        requestId: requestMeta.requestId,
      })
    })
    .get('/advisor/post-mortem', async context => {
      const accessError = ensureAdvisorAccess({ context, advisorEnabled, adminOnly })
      if (accessError) return accessError

      const dashboard = getDashboardRuntime(context)
      if (!dashboard.useCases.listAdvisorPostMortems) {
        return buildAdvisorRouteError({
          context,
          status: 503,
          code: 'ADVISOR_RUNTIME_UNAVAILABLE',
          message: 'Advisor post-mortem runtime is unavailable.',
        })
      }
      const auth = getAuth(context)
      const requestMeta = getRequestMeta(context)
      return dashboard.useCases.listAdvisorPostMortems({
        mode: auth.mode,
        requestId: requestMeta.requestId,
      })
    })
    .get(
      '/advisor/post-mortem/:postMortemId',
      async context => {
        const accessError = ensureAdvisorAccess({ context, advisorEnabled, adminOnly })
        if (accessError) return accessError

        const dashboard = getDashboardRuntime(context)
        if (!dashboard.useCases.getAdvisorPostMortemById) {
          return buildAdvisorRouteError({
            context,
            status: 503,
            code: 'ADVISOR_RUNTIME_UNAVAILABLE',
            message: 'Advisor post-mortem runtime is unavailable.',
          })
        }
        const auth = getAuth(context)
        const requestMeta = getRequestMeta(context)
        const row = await dashboard.useCases.getAdvisorPostMortemById({
          mode: auth.mode,
          requestId: requestMeta.requestId,
          postMortemId: context.params.postMortemId,
        })
        if (!row) {
          return buildAdvisorRouteError({
            context,
            status: 404,
            code: 'NOT_FOUND',
            message: 'Post-mortem not found.',
          })
        }
        return row
      },
      {
        params: dashboardAdvisorPostMortemParamsSchema,
      }
    )
    .post(
      '/advisor/post-mortem/run',
      async context => {
        const accessError = ensureAdvisorAccess({ context, advisorEnabled, adminOnly })
        if (accessError) return accessError

        // PR4-fix-2: admin-session only. The worker scheduler is deferred (PR4 deferred
        // decision); internal-token trigger support will land alongside the scheduler PR with
        // its own dedicated tested execution context. Keeping this guard strict avoids the
        // route/use-case auth contract mismatch surfaced during PR4-fix testing where an
        // internal-token-only caller passed the route but tripped the use-case's defensive
        // demo-mode throw.
        const adminError = ensureAdminSessionOnly({
          context,
          message: 'Admin session required for post-mortem runs.',
        })
        if (adminError) return adminError

        const dashboard = getDashboardRuntime(context)
        if (!dashboard.useCases.runAdvisorPostMortem) {
          return buildAdvisorRouteError({
            context,
            status: 503,
            code: 'ADVISOR_RUNTIME_UNAVAILABLE',
            message: 'Advisor post-mortem runtime is unavailable.',
          })
        }
        const auth = getAuth(context)
        const requestMeta = getRequestMeta(context)
        return dashboard.useCases.runAdvisorPostMortem({
          mode: auth.mode,
          requestId: requestMeta.requestId,
          triggerSource: context.body.trigger ?? 'manual',
        })
      },
      {
        body: dashboardAdvisorRunBodySchema,
      }
    )
    .get(
      '/advisor/journal',
      async context => {
        const accessError = ensureAdvisorAccess({
          context,
          advisorEnabled,
          adminOnly,
        })
        if (accessError) {
          return accessError
        }

        const dashboard = getDashboardRuntime(context)
        if (!dashboard.useCases.listAdvisorDecisionJournal) {
          return buildAdvisorRouteError({
            context,
            status: 503,
            code: 'ADVISOR_RUNTIME_UNAVAILABLE',
            message: 'Advisor decision journal runtime is unavailable.',
          })
        }

        const auth = getAuth(context)
        const requestMeta = getRequestMeta(context)
        return dashboard.useCases.listAdvisorDecisionJournal({
          mode: auth.mode,
          requestId: requestMeta.requestId,
          ...(context.query.limit !== undefined ? { limit: context.query.limit } : {}),
          ...(context.query.recommendationId !== undefined
            ? { recommendationId: context.query.recommendationId }
            : {}),
          ...(context.query.runId !== undefined ? { runId: context.query.runId } : {}),
          ...(context.query.decision !== undefined ? { decision: context.query.decision } : {}),
        })
      },
      {
        query: dashboardAdvisorJournalListQuerySchema,
      }
    )
    .get(
      '/advisor/journal/:decisionId',
      async context => {
        const accessError = ensureAdvisorAccess({
          context,
          advisorEnabled,
          adminOnly,
        })
        if (accessError) {
          return accessError
        }

        const dashboard = getDashboardRuntime(context)
        if (!dashboard.useCases.getAdvisorDecisionJournalEntry) {
          return buildAdvisorRouteError({
            context,
            status: 503,
            code: 'ADVISOR_RUNTIME_UNAVAILABLE',
            message: 'Advisor decision journal runtime is unavailable.',
          })
        }

        const auth = getAuth(context)
        const requestMeta = getRequestMeta(context)
        const entry = await dashboard.useCases.getAdvisorDecisionJournalEntry({
          mode: auth.mode,
          requestId: requestMeta.requestId,
          decisionId: context.params.decisionId,
        })

        if (!entry) {
          return buildAdvisorRouteError({
            context,
            status: 404,
            code: 'NOT_FOUND',
            message: 'Decision journal entry not found.',
          })
        }

        return entry
      },
      {
        params: dashboardAdvisorJournalParamsSchema,
      }
    )
    .post(
      '/advisor/journal',
      async context => {
        const accessError = ensureAdvisorAccess({
          context,
          advisorEnabled,
          adminOnly,
        })
        if (accessError) {
          return accessError
        }

        const adminError = ensureAdminSessionOnly({
          context,
          message: 'Admin session required for decision journal entries.',
        })
        if (adminError) {
          return adminError
        }

        const dashboard = getDashboardRuntime(context)
        if (!dashboard.useCases.createAdvisorDecisionJournalEntry) {
          return buildAdvisorRouteError({
            context,
            status: 503,
            code: 'ADVISOR_RUNTIME_UNAVAILABLE',
            message: 'Advisor decision journal runtime is unavailable.',
          })
        }

        const auth = getAuth(context)
        const requestMeta = getRequestMeta(context)
        try {
          const created = await dashboard.useCases.createAdvisorDecisionJournalEntry({
            mode: auth.mode,
            requestId: requestMeta.requestId,
            decision: context.body.decision,
            reasonCode: context.body.reasonCode,
            ...(context.body.recommendationId !== undefined
              ? { recommendationId: context.body.recommendationId }
              : {}),
            ...(context.body.runId !== undefined ? { runId: context.body.runId } : {}),
            ...(context.body.recommendationKey !== undefined
              ? { recommendationKey: context.body.recommendationKey }
              : {}),
            ...(context.body.freeNote !== undefined ? { freeNote: context.body.freeNote } : {}),
            ...(context.body.decidedBy !== undefined ? { decidedBy: context.body.decidedBy } : {}),
            ...(context.body.expectedOutcomeAt !== undefined
              ? { expectedOutcomeAt: context.body.expectedOutcomeAt }
              : {}),
            ...(context.body.metadata !== undefined ? { metadata: context.body.metadata } : {}),
          })
          context.set.status = 201
          return created
        } catch (error) {
          if (isDecisionJournalValidationError(error)) {
            return buildAdvisorRouteError({
              context,
              status: 422,
              code: error.code,
              message: error.message,
            })
          }
          throw error
        }
      },
      {
        body: dashboardAdvisorJournalCreateBodySchema,
      }
    )
    .post(
      '/advisor/journal/:decisionId/outcomes',
      async context => {
        const accessError = ensureAdvisorAccess({
          context,
          advisorEnabled,
          adminOnly,
        })
        if (accessError) {
          return accessError
        }

        const adminError = ensureAdminSessionOnly({
          context,
          message: 'Admin session required for decision outcome entries.',
        })
        if (adminError) {
          return adminError
        }

        const dashboard = getDashboardRuntime(context)
        if (
          !dashboard.useCases.createAdvisorDecisionOutcome ||
          !dashboard.useCases.getAdvisorDecisionJournalEntry
        ) {
          return buildAdvisorRouteError({
            context,
            status: 503,
            code: 'ADVISOR_RUNTIME_UNAVAILABLE',
            message: 'Advisor decision journal runtime is unavailable.',
          })
        }

        const auth = getAuth(context)
        const requestMeta = getRequestMeta(context)

        const parent = await dashboard.useCases.getAdvisorDecisionJournalEntry({
          mode: auth.mode,
          requestId: requestMeta.requestId,
          decisionId: context.params.decisionId,
        })

        if (!parent) {
          return buildAdvisorRouteError({
            context,
            status: 404,
            code: 'NOT_FOUND',
            message: 'Decision journal entry not found.',
          })
        }

        context.set.status = 201
        return dashboard.useCases.createAdvisorDecisionOutcome({
          mode: auth.mode,
          requestId: requestMeta.requestId,
          decisionId: context.params.decisionId,
          outcomeKind: context.body.outcomeKind,
          ...(context.body.deltaMetrics !== undefined
            ? { deltaMetrics: context.body.deltaMetrics }
            : {}),
          ...(context.body.learningTags !== undefined
            ? { learningTags: context.body.learningTags }
            : {}),
          ...(context.body.freeNote !== undefined ? { freeNote: context.body.freeNote } : {}),
        })
      },
      {
        params: dashboardAdvisorJournalParamsSchema,
        body: dashboardAdvisorDecisionOutcomeCreateBodySchema,
      }
    )
    .post(
      '/advisor/run-daily',
      async context => {
        const accessError = ensureAdvisorAccess({
          context,
          advisorEnabled,
          adminOnly,
        })
        if (accessError) {
          return accessError
        }

        const adminError = ensureAdminMutationAccess({
          context,
          message: 'Admin session or internal token required for advisor runs.',
        })
        if (adminError) {
          return adminError
        }

        const dashboard = getDashboardRuntime(context)
        if (!dashboard.useCases.runAdvisorDaily) {
          return buildAdvisorRouteError({
            context,
            status: 503,
            code: 'ADVISOR_RUNTIME_UNAVAILABLE',
            message: 'Advisor run runtime is unavailable.',
          })
        }

        const auth = getAuth(context)
        const requestMeta = getRequestMeta(context)
        return dashboard.useCases.runAdvisorDaily({
          mode: auth.mode,
          requestId: requestMeta.requestId,
          triggerSource: context.body.trigger ?? 'manual',
        })
      },
      {
        body: dashboardAdvisorRunBodySchema,
      }
    )
    .post(
      '/advisor/relabel-transactions',
      async context => {
        const accessError = ensureAdvisorAccess({
          context,
          advisorEnabled,
          adminOnly,
        })
        if (accessError) {
          return accessError
        }

        const relabelError = ensureFeatureEnabled({
          context,
          enabled: relabelEnabled,
          code: 'ADVISOR_RELABEL_DISABLED',
          message: 'Advisor transaction relabeling is disabled by feature flag.',
        })
        if (relabelError) {
          return relabelError
        }

        const adminError = ensureAdminMutationAccess({
          context,
          message: 'Admin session or internal token required for relabeling.',
        })
        if (adminError) {
          return adminError
        }

        const dashboard = getDashboardRuntime(context)
        if (!dashboard.useCases.relabelAdvisorTransactions) {
          return buildAdvisorRouteError({
            context,
            status: 503,
            code: 'ADVISOR_RUNTIME_UNAVAILABLE',
            message: 'Advisor relabel runtime is unavailable.',
          })
        }

        const auth = getAuth(context)
        const requestMeta = getRequestMeta(context)
        return dashboard.useCases.relabelAdvisorTransactions({
          mode: auth.mode,
          requestId: requestMeta.requestId,
          triggerSource: context.body.trigger ?? 'manual',
        })
      },
      {
        body: dashboardAdvisorRunBodySchema,
      }
    )
