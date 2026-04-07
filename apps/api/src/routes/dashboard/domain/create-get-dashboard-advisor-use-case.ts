import { getDashboardSummaryMock } from '../../../mocks/dashboardSummary.mock'
import type { DashboardAdvisorResponse, DashboardRange, DashboardSummaryResponse } from '../types'

export interface DashboardAdvisorFlags {
  advisorEnabled: boolean
  adminOnly: boolean
  forceLocalOnly: boolean
}

export type DashboardAdvisorSummarySource = 'mock' | 'provider'

export interface DashboardAdvisorRetrievalPlan {
  mode: 'demo' | 'admin'
  source: DashboardAdvisorResponse['source']
  fallback: boolean
  fallbackReason: string | null
  degradedMessage: string | null
  summarySource: DashboardAdvisorSummarySource
}

export interface GetDashboardAdvisorResult {
  plan: DashboardAdvisorRetrievalPlan
  summary: DashboardSummaryResponse
}

export const readDashboardAdvisorFlags = (): DashboardAdvisorFlags => ({
  advisorEnabled: process.env.AI_ADVISOR_ENABLED !== '0' && process.env.AI_ADVISOR_ENABLED !== 'false',
  adminOnly: process.env.AI_ADVISOR_ADMIN_ONLY === '1' || process.env.AI_ADVISOR_ADMIN_ONLY === 'true',
  forceLocalOnly: process.env.AI_ADVISOR_FORCE_LOCAL_ONLY === '1' || process.env.AI_ADVISOR_FORCE_LOCAL_ONLY === 'true',
})

export const createGetDashboardAdvisorUseCase = ({
  getSummary,
}: {
  getSummary: (range: DashboardRange) => Promise<DashboardSummaryResponse>
}) => {
  return async ({ mode, range }: { mode: 'demo' | 'admin'; range: DashboardRange }): Promise<GetDashboardAdvisorResult> => {
    if (mode === 'demo') {
      return {
        plan: {
          mode,
          source: 'local',
          fallback: false,
          fallbackReason: null,
          degradedMessage: null,
          summarySource: 'mock',
        },
        summary: getDashboardSummaryMock(range),
      }
    }

    const flags = readDashboardAdvisorFlags()

    if (flags.forceLocalOnly) {
      return {
        plan: {
          mode,
          source: 'local',
          fallback: true,
          fallbackReason: 'force_local_only',
          degradedMessage: 'Conseils limites, source externe indisponible',
          summarySource: 'mock',
        },
        summary: getDashboardSummaryMock(range),
      }
    }

    try {
      return {
        plan: {
          mode,
          source: 'provider',
          fallback: false,
          fallbackReason: null,
          degradedMessage: null,
          summarySource: 'provider',
        },
        summary: await getSummary(range),
      }
    } catch {
      return {
        plan: {
          mode,
          source: 'local',
          fallback: true,
          fallbackReason: 'provider_unavailable',
          degradedMessage: 'Conseils limites, source externe indisponible',
          summarySource: 'mock',
        },
        summary: getDashboardSummaryMock(range),
      }
    }
  }
}
