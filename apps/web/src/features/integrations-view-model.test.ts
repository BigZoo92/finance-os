import { describe, expect, it } from 'vitest'
import { getDemoPowensStatus } from './demo-data'
import { getDemoExternalInvestmentStatus } from './external-investments/demo-data'
import {
  canRunIntegrationAction,
  createIntegrationProviders,
  getSafeIntegrationError,
} from './integrations-view-model'

describe('integration provider presentation', () => {
  it('maps Powens connection states to human actions', () => {
    const response = getDemoPowensStatus()
    expect(createIntegrationProviders({ powens: response, external: null })[0]).toMatchObject({
      state: 'reconnect_required',
      primaryAction: 'reconnect',
      primaryActionLabel: 'Reconnecter',
    })
    expect(
      createIntegrationProviders({ powens: { ...response, connections: [] }, external: null })[0]
    ).toMatchObject({ state: 'not_configured', primaryAction: 'connect' })
  })

  it('uses the legitimate connect flow for reconnect-required state', () => {
    const model = createIntegrationProviders({ powens: getDemoPowensStatus(), external: null })[0]
    expect(model?.primaryAction).toBe('reconnect')
  })

  it('gates mutations by Admin mode, safe mode and pending state', () => {
    expect(
      canRunIntegrationAction({ isAdmin: false, pending: false, safeMode: false, action: 'sync' })
    ).toBe(false)
    expect(
      canRunIntegrationAction({ isAdmin: true, pending: false, safeMode: true, action: 'sync' })
    ).toBe(false)
    expect(
      canRunIntegrationAction({ isAdmin: true, pending: true, safeMode: false, action: 'sync' })
    ).toBe(false)
    expect(
      canRunIntegrationAction({ isAdmin: true, pending: false, safeMode: false, action: 'sync' })
    ).toBe(true)
  })

  it('maps IBKR and Binance without exposing configuration internals', () => {
    const providers = createIntegrationProviders({
      powens: null,
      external: getDemoExternalInvestmentStatus(),
    })
    expect(providers.slice(1).map(provider => provider.state)).toEqual(['up_to_date', 'attention'])
    expect(JSON.stringify(providers)).not.toMatch(/token|secret|requestId|credential|environment/i)
  })

  it('never returns a raw server error', () => {
    const raw = 'ECONNREFUSED PRIVATE_TOKEN request req-123'
    expect(getSafeIntegrationError('sync')).not.toContain(raw)
    expect(getSafeIntegrationError('sync')).not.toMatch(/token|request/i)
  })
})
