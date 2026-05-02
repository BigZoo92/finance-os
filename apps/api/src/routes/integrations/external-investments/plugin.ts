import { Elysia } from 'elysia'
import type { ExternalInvestmentsRouteRuntime } from './types'

export const createExternalInvestmentsRuntimePlugin = (
  runtime: ExternalInvestmentsRouteRuntime
) => {
  return new Elysia().decorate('externalInvestments', runtime)
}
