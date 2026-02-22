import { Elysia } from 'elysia'
import type { DashboardRouteRuntime } from './types'

export const createDashboardRuntimePlugin = (runtime: DashboardRouteRuntime) => {
  return new Elysia({ name: 'dashboard.runtime' }).decorate('dashboard', runtime)
}
