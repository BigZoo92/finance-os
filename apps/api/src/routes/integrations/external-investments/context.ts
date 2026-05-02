import type { ExternalInvestmentsRouteRuntime } from './types'

export const getExternalInvestmentsRuntime = <TContext extends object>(
  context: TContext
): ExternalInvestmentsRouteRuntime => {
  return (context as TContext & { externalInvestments: ExternalInvestmentsRouteRuntime })
    .externalInvestments
}
