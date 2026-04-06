import { logApiEvent, toErrorLogFields } from '../../../observability/logger'
import type { DashboardNewsResponse } from '../types'
import { getDashboardNewsFixture } from './static-fixture-pack'

export type DashboardDatasetSource = 'demo_fixture' | 'admin_live' | 'admin_fallback'

const shouldForceAdminFixtureFallback = () => {
  const value = process.env.DASHBOARD_NEWS_FORCE_FIXTURE_FALLBACK
  return value === '1' || value === 'true'
}

const withDatasetSource = (
  payload: DashboardNewsResponse,
  datasetSource: DashboardDatasetSource,
  mode: 'demo' | 'admin'
): DashboardNewsResponse => ({
  ...payload,
  dataset: {
    version: payload.dataset?.version ?? 'dashboard-fixture-pack:legacy',
    source: datasetSource,
    mode,
    isDemoData: datasetSource !== 'admin_live',
  },
})

export const selectDashboardNewsDataset = async ({
  mode,
  requestId,
  live,
}: {
  mode: 'demo' | 'admin'
  requestId: string
  live: () => Promise<DashboardNewsResponse>
}): Promise<DashboardNewsResponse> => {
  if (mode === 'demo') {
    const fixturePayload = getDashboardNewsFixture(requestId)
    logApiEvent({
      level: 'info',
      msg: 'dashboard dataset selected',
      requestId,
      dataset_domain: 'news',
      dataset_source: 'demo_fixture',
      dataset_source_counter: 1,
      auth_mode: mode,
    })
    return fixturePayload
  }

  if (shouldForceAdminFixtureFallback()) {
    const fallbackPayload = withDatasetSource(getDashboardNewsFixture(requestId), 'admin_fallback', 'admin')
    logApiEvent({
      level: 'warn',
      msg: 'dashboard dataset selected via kill-switch fallback',
      requestId,
      dataset_domain: 'news',
      dataset_source: 'admin_fallback',
      dataset_source_counter: 1,
      auth_mode: mode,
      fallback_reason: 'force_fixture_fallback',
    })
    return fallbackPayload
  }

  try {
    const livePayload = withDatasetSource(await live(), 'admin_live', 'admin')
    logApiEvent({
      level: 'info',
      msg: 'dashboard dataset selected',
      requestId,
      dataset_domain: 'news',
      dataset_source: 'admin_live',
      dataset_source_counter: 1,
      auth_mode: mode,
    })
    return livePayload
  } catch (error) {
    const fallbackPayload = withDatasetSource(getDashboardNewsFixture(requestId), 'admin_fallback', 'admin')
    logApiEvent({
      level: 'warn',
      msg: 'dashboard dataset selected via admin fallback',
      requestId,
      dataset_domain: 'news',
      dataset_source: 'admin_fallback',
      dataset_source_counter: 1,
      auth_mode: mode,
      fallback_reason: 'live_fetch_failed',
      ...toErrorLogFields({
        error,
        includeStack: false,
      }),
    })
    return fallbackPayload
  }
}
