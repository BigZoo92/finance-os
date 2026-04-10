import { logApiEvent, toErrorLogFields } from '../../../observability/logger'
import type { DashboardMarketsOverviewResponse } from './markets-types'
import { getDashboardMarketsFixture } from './market-fixture-pack'

const withDatasetSource = (
  payload: DashboardMarketsOverviewResponse,
  datasetSource: 'demo_fixture' | 'admin_live' | 'admin_fallback',
  mode: 'demo' | 'admin'
): DashboardMarketsOverviewResponse => ({
  ...payload,
  dataset: {
    version: payload.dataset?.version ?? 'markets-fixture-pack:2026-04-10',
    source: datasetSource,
    mode,
    isDemoData: datasetSource !== 'admin_live',
  },
})

export const selectDashboardMarketsDataset = async ({
  mode,
  requestId,
  forceFixtureFallback,
  live,
}: {
  mode: 'demo' | 'admin'
  requestId: string
  forceFixtureFallback: boolean
  live: () => Promise<DashboardMarketsOverviewResponse>
}): Promise<DashboardMarketsOverviewResponse> => {
  if (mode === 'demo') {
    const payload = getDashboardMarketsFixture(requestId)
    logApiEvent({
      level: 'info',
      msg: 'dashboard dataset selected',
      requestId,
      dataset_domain: 'markets',
      dataset_source: 'demo_fixture',
      auth_mode: mode,
    })
    return payload
  }

  if (forceFixtureFallback) {
    const payload = withDatasetSource(getDashboardMarketsFixture(requestId), 'admin_fallback', 'admin')
    logApiEvent({
      level: 'warn',
      msg: 'dashboard dataset selected via kill-switch fallback',
      requestId,
      dataset_domain: 'markets',
      dataset_source: 'admin_fallback',
      auth_mode: mode,
      fallback_reason: 'force_fixture_fallback',
    })
    return payload
  }

  try {
    const livePayload = withDatasetSource(await live(), 'admin_live', 'admin')
    logApiEvent({
      level: 'info',
      msg: 'dashboard dataset selected',
      requestId,
      dataset_domain: 'markets',
      dataset_source: 'admin_live',
      auth_mode: mode,
    })
    return livePayload
  } catch (error) {
    const payload = withDatasetSource(getDashboardMarketsFixture(requestId), 'admin_fallback', 'admin')
    logApiEvent({
      level: 'warn',
      msg: 'dashboard dataset selected via admin fallback',
      requestId,
      dataset_domain: 'markets',
      dataset_source: 'admin_fallback',
      auth_mode: mode,
      fallback_reason: 'live_fetch_failed',
      ...toErrorLogFields({
        error,
        includeStack: false,
      }),
    })
    return payload
  }
}
