import { apiFetch } from '@/lib/api'
import type { ValuationStatusResponse, ValuationUnresolvedResponse } from './types'

export const fetchValuationStatus = () =>
  apiFetch<ValuationStatusResponse>('/dashboard/valuation/status')

export const fetchValuationUnresolved = () =>
  apiFetch<ValuationUnresolvedResponse>('/dashboard/valuation/unresolved')

export const runValuationRefresh = ({ dryRun }: { dryRun: boolean }) =>
  apiFetch<ValuationStatusResponse>('/dashboard/valuation/refresh', {
    method: 'POST',
    body: JSON.stringify({ dryRun }),
  })
