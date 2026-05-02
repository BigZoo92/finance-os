import { apiFetch, ApiRequestError } from '@/lib/api'
import {
  getDemoExternalInvestmentCashFlows,
  getDemoExternalInvestmentPositions,
  getDemoExternalInvestmentStatus,
  getDemoExternalInvestmentSummary,
  getDemoExternalInvestmentSyncRuns,
  getDemoExternalInvestmentTrades,
} from './demo-data'
import type {
  ExternalInvestmentCashFlow,
  ExternalInvestmentCredentialInput,
  ExternalInvestmentListResponse,
  ExternalInvestmentPosition,
  ExternalInvestmentProvider,
  ExternalInvestmentStatusResponse,
  ExternalInvestmentSummaryResponse,
  ExternalInvestmentSyncRunsResponse,
  ExternalInvestmentTrade,
} from './types'

const shouldUseDemoFallback = (error: unknown) =>
  error instanceof ApiRequestError &&
  (error.status === 'network_error' ||
    error.status === 401 ||
    error.status === 403 ||
    error.status === 404 ||
    error.status >= 500)

export const fetchExternalInvestmentSummary = async () => {
  try {
    return await apiFetch<ExternalInvestmentSummaryResponse>(
      '/dashboard/external-investments/summary'
    )
  } catch (error) {
    if (shouldUseDemoFallback(error)) return getDemoExternalInvestmentSummary()
    return getDemoExternalInvestmentSummary()
  }
}

export const fetchExternalInvestmentPositions = async () => {
  try {
    return await apiFetch<ExternalInvestmentListResponse<ExternalInvestmentPosition>>(
      '/dashboard/external-investments/positions'
    )
  } catch (error) {
    if (shouldUseDemoFallback(error)) return getDemoExternalInvestmentPositions()
    return getDemoExternalInvestmentPositions()
  }
}

export const fetchExternalInvestmentTrades = async (limit = 50) => {
  try {
    return await apiFetch<ExternalInvestmentListResponse<ExternalInvestmentTrade>>(
      `/dashboard/external-investments/trades?limit=${limit}`
    )
  } catch (error) {
    if (shouldUseDemoFallback(error)) return getDemoExternalInvestmentTrades()
    return getDemoExternalInvestmentTrades()
  }
}

export const fetchExternalInvestmentCashFlows = async (limit = 50) => {
  try {
    return await apiFetch<ExternalInvestmentListResponse<ExternalInvestmentCashFlow>>(
      `/dashboard/external-investments/cash-flows?limit=${limit}`
    )
  } catch (error) {
    if (shouldUseDemoFallback(error)) return getDemoExternalInvestmentCashFlows()
    return getDemoExternalInvestmentCashFlows()
  }
}

export const fetchExternalInvestmentStatus = async () => {
  try {
    return await apiFetch<ExternalInvestmentStatusResponse>(
      '/integrations/external-investments/status'
    )
  } catch (error) {
    if (shouldUseDemoFallback(error)) return getDemoExternalInvestmentStatus()
    return getDemoExternalInvestmentStatus()
  }
}

export const fetchExternalInvestmentSyncRuns = async () => {
  try {
    return await apiFetch<ExternalInvestmentSyncRunsResponse>(
      '/integrations/external-investments/sync-runs'
    )
  } catch (error) {
    if (shouldUseDemoFallback(error)) return getDemoExternalInvestmentSyncRuns()
    return getDemoExternalInvestmentSyncRuns()
  }
}

export const postExternalInvestmentSync = (provider?: ExternalInvestmentProvider) => {
  const path = provider
    ? `/integrations/external-investments/${provider}/sync`
    : '/integrations/external-investments/sync'
  return apiFetch<{ ok: boolean; requestId: string; enqueued: ExternalInvestmentProvider[] }>(path, {
    method: 'POST',
  })
}

export const putExternalInvestmentCredential = (input: ExternalInvestmentCredentialInput) => {
  const { provider, ...body } = input
  return apiFetch<{
    ok: boolean
    requestId: string
    provider: ExternalInvestmentProvider
    credential: Record<string, unknown>
  }>(`/integrations/external-investments/${provider}/credential`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

export const deleteExternalInvestmentCredential = (provider: ExternalInvestmentProvider) =>
  apiFetch<{ ok: boolean; requestId: string; provider: ExternalInvestmentProvider; deleted: boolean }>(
    `/integrations/external-investments/${provider}/credential`,
    {
      method: 'DELETE',
    }
  )
