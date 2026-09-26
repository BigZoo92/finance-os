import type { DashboardRouteRuntime } from '../types'

type RuntimeRepositories = DashboardRouteRuntime['repositories']

const unusedRepository = <T>(name: string): T =>
  new Proxy({} as object, {
    get: (_target, property) => {
      if (property === 'then') return undefined
      throw new Error(
        `repository ${name}.${String(property)} is not available in this test fixture`
      )
    },
  }) as T

/**
 * Route tests exercise HTTP behavior through use cases; repositories the
 * route under test never touches are stubs that fail loudly when reached.
 */
export const createRuntimeRepositoriesFixture = (
  overrides: Partial<RuntimeRepositories> = {}
): RuntimeRepositories => ({
  readModel: unusedRepository('readModel'),
  derivedRecompute: unusedRepository('derivedRecompute'),
  signalSources: unusedRepository('signalSources'),
  signalItems: unusedRepository('signalItems'),
  tradingLab: unusedRepository('tradingLab'),
  userCategorizationRules: unusedRepository('userCategorizationRules'),
  ...overrides,
})
