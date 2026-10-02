import type { DashboardAnalyticsWidgetState } from '@finance-os/api-contract/analytics'

export type { DashboardAnalyticsResponse } from '@finance-os/api-contract/analytics'

export type AnalyticsWidgetState = DashboardAnalyticsWidgetState

export type AnalyticsPageState = 'loading' | 'ready' | 'empty' | 'degraded' | 'error'
