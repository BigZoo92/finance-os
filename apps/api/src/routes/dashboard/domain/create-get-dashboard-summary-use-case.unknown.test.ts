import { describe, expect, it } from 'bun:test'
import { createGetDashboardSummaryUseCase } from './create-get-dashboard-summary-use-case'

// Financial invariant: a missing persisted valuation or balance is unknown
// (null) in the DTO, never 0, and never shrinks a total silently.

const buildUseCase = ({
  assetValuation,
  accountBalance,
}: {
  assetValuation: string | null
  accountBalance: string | null
}) =>
  createGetDashboardSummaryUseCase({
    listAccountsWithConnections: async () => [
      {
        powensAccountId: 'acc-1',
        powensConnectionId: 'conn-1',
        source: 'banking',
        provider: 'powens',
        providerConnectionId: 'conn-1',
        providerInstitutionId: 'bank-1',
        providerInstitutionName: 'Bank 1',
        accountName: 'Main account',
        accountCurrency: 'EUR',
        accountType: 'checking',
        accountMetadata: null,
        enabled: true,
        accountBalance,
        connectionStatus: 'connected',
        lastSyncAttemptAt: null,
        lastSyncAt: null,
        lastSuccessAt: null,
        lastFailedAt: null,
        lastError: null,
        syncMetadata: null,
      },
      {
        powensAccountId: 'acc-2',
        powensConnectionId: 'conn-1',
        source: 'banking',
        provider: 'powens',
        providerConnectionId: 'conn-1',
        providerInstitutionId: 'bank-1',
        providerInstitutionName: 'Bank 1',
        accountName: 'Savings',
        accountCurrency: 'EUR',
        accountType: 'savings',
        accountMetadata: null,
        enabled: true,
        accountBalance: '100.00',
        connectionStatus: 'connected',
        lastSyncAttemptAt: null,
        lastSyncAt: null,
        lastSuccessAt: null,
        lastFailedAt: null,
        lastError: null,
        syncMetadata: null,
      },
    ],
    listAssets: async () => [
      {
        assetId: 1,
        assetType: 'cash',
        origin: 'provider',
        source: 'banking',
        provider: 'powens',
        providerConnectionId: 'conn-1',
        providerExternalAssetId: null,
        providerInstitutionName: 'Bank 1',
        powensConnectionId: 'conn-1',
        powensAccountId: 'acc-1',
        name: 'Main account',
        currency: 'EUR',
        valuation: assetValuation,
        valuationAsOf: null,
        enabled: true,
        metadata: null,
      },
      {
        assetId: 2,
        assetType: 'investment',
        origin: 'manual',
        source: 'manual',
        provider: null,
        providerConnectionId: null,
        providerExternalAssetId: null,
        providerInstitutionName: null,
        powensConnectionId: null,
        powensAccountId: null,
        name: 'World ETF',
        currency: 'EUR',
        valuation: '250.00',
        valuationAsOf: null,
        enabled: true,
        metadata: null,
      },
    ],
    listInvestmentPositions: async () => [],
    getFlowTotals: async () => ({ income: '0', expenses: '0' }),
    listDailyNetFlows: async () => [],
    listTopExpenseGroups: async () => [],
    now: () => new Date('2026-09-25T12:00:00.000Z'),
  })

describe('createGetDashboardSummaryUseCase (unknown values)', () => {
  it('keeps a null asset valuation and account balance unknown instead of 0', async () => {
    const summary = await buildUseCase({ assetValuation: null, accountBalance: null })('7d')

    expect(summary.assets.find(asset => asset.assetId === 1)?.valuation).toBeNull()
    expect(summary.assets.find(asset => asset.assetId === 2)?.valuation).toBe(250)
    expect(summary.accounts.find(account => account.powensAccountId === 'acc-1')?.balance).toBeNull()
    expect(summary.accounts.find(account => account.powensAccountId === 'acc-2')?.balance).toBe(100)
    // One unknown account balance makes the connection total unknown.
    expect(summary.connections[0]?.balance).toBeNull()
    // One unknown asset makes the legacy total unknown, and says why.
    expect(summary.totals.balance).toBeNull()
    expect(summary.totals.unknownValuationAssetCount).toBe(1)
    // No wealth history can be reconstructed from an unknown total.
    expect(summary.dailyWealthSnapshots).toEqual([])
  })

  it('keeps a true zero valuation and balance representable', async () => {
    const summary = await buildUseCase({ assetValuation: '0', accountBalance: '0.00' })('7d')

    expect(summary.assets.find(asset => asset.assetId === 1)?.valuation).toBe(0)
    expect(summary.accounts.find(account => account.powensAccountId === 'acc-1')?.balance).toBe(0)
    expect(summary.connections[0]?.balance).toBe(100)
    expect(summary.totals.balance).toBe(250)
    expect(summary.totals.unknownValuationAssetCount).toBe(0)
    expect(summary.dailyWealthSnapshots.length).toBeGreaterThan(0)
  })
})
