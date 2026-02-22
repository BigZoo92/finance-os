import type { DashboardRouteRuntime } from './types'

export const getDashboardRuntime = <TContext extends object>(
  context: TContext
): DashboardRouteRuntime => {
  return (context as TContext & { dashboard: DashboardRouteRuntime }).dashboard
}
