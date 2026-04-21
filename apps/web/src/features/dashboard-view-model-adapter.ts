import type { AuthMode } from './auth-types'
import { getDemoDashboardSummary } from './demo-data'
import {
  adaptDashboardSummaryLegacy,
  type LegacyDashboardAdapterResult,
} from './dashboard-legacy-adapter'
import type { DashboardRange, DashboardSummaryResponse } from './dashboard-types'

export type DailySurfaceAdapterMode = 'demoAdapter' | 'adminAdapter'

export type DailySurfaceAdapterResult = LegacyDashboardAdapterResult & {
  adapter: DailySurfaceAdapterMode
}

const shouldUseLegacyMapper = () => true

const demoAdapter = ({ range }: { range: DashboardRange }): DailySurfaceAdapterResult => {
  const summary = getDemoDashboardSummary(range)
  const adapted = adaptDashboardSummaryLegacy({
    range,
    summary,
    mode: 'demo',
  })

  return {
    ...adapted,
    adapter: 'demoAdapter',
  }
}

const adminAdapter = ({
  range,
  summary,
}: {
  range: DashboardRange
  summary: DashboardSummaryResponse | undefined
}): DailySurfaceAdapterResult => {
  const adapted = adaptDashboardSummaryLegacy({
    range,
    summary,
    mode: 'admin',
  })

  return {
    ...adapted,
    adapter: 'adminAdapter',
  }
}

export const adaptDailySurfaceViewModel = ({
  mode,
  range,
  summary,
}: {
  mode: AuthMode
  range: DashboardRange
  summary: DashboardSummaryResponse | undefined
}): DailySurfaceAdapterResult => {
  if (!shouldUseLegacyMapper()) {
    return mode === 'demo' ? demoAdapter({ range }) : adminAdapter({ range, summary })
  }

  return mode === 'demo' ? demoAdapter({ range }) : adminAdapter({ range, summary })
}
