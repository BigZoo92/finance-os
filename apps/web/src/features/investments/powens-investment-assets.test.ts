import { describe, expect, it } from 'vitest'
import type { DashboardSummaryResponse } from '../dashboard-types'
import {
  getUnpositionedPowensInvestmentAssets,
  type PowensInvestmentAsset,
  sumPowensInvestmentAssetValuations,
} from './powens-investment-assets'

type DashboardAsset = DashboardSummaryResponse['assets'][number]
type DashboardPosition = DashboardSummaryResponse['positions'][number]

const createAsset = (overrides: Partial<DashboardAsset>): DashboardAsset => ({
  assetId: 1,
  type: 'investment',
  origin: 'provider',
  source: 'banking',
  provider: 'powens',
  providerConnectionId: 'connection-1',
  providerInstitutionName: 'Trade Republic',
  powensConnectionId: 'connection-1',
  powensAccountId: 'account-1',
  name: 'PEA Trade Republic',
  currency: 'EUR',
  valuation: 1234.56,
  valuationAsOf: '2026-05-12T08:00:00.000Z',
  enabled: true,
  metadata: null,
  ...overrides,
})

const createPowensInvestmentAsset = (
  overrides: Partial<DashboardAsset> = {}
): PowensInvestmentAsset => ({
  ...createAsset({ ...overrides, provider: 'powens' }),
  provider: 'powens',
})

const createPosition = (overrides: Partial<DashboardPosition>): DashboardPosition => ({
  positionId: 1,
  positionKey: 'position-1',
  assetId: 1,
  powensAccountId: 'account-1',
  powensConnectionId: 'connection-1',
  source: 'banking',
  provider: 'powens',
  providerConnectionId: 'connection-1',
  providerPositionId: 'provider-position-1',
  assetName: 'PEA Trade Republic',
  accountName: 'PEA Trade Republic',
  name: 'ETF Monde',
  currency: 'EUR',
  quantity: 1,
  costBasis: null,
  costBasisSource: 'unknown',
  currentValue: 1234.56,
  lastKnownValue: null,
  openedAt: null,
  closedAt: null,
  valuedAt: null,
  lastSyncedAt: null,
  enabled: true,
  metadata: null,
  ...overrides,
})

describe('powens investment assets', () => {
  it('keeps active Powens investment assets that do not have detailed positions yet', () => {
    const assets = [
      createAsset({ assetId: 1, name: 'PEA Trade Republic' }),
      createAsset({ assetId: 2, type: 'cash', name: 'Compte courant' }),
      createAsset({ assetId: 3, provider: 'ibkr', name: 'IBKR' }),
      createAsset({ assetId: 4, enabled: false, name: 'PEA ferme' }),
    ]

    expect(getUnpositionedPowensInvestmentAssets({ assets, positions: [] })).toEqual([assets[0]])
  })

  it('drops Powens investment assets that already have active detailed positions', () => {
    const assets = [createAsset({ assetId: 1 }), createAsset({ assetId: 2 })]
    const positions = [createPosition({ assetId: 1 })]

    expect(getUnpositionedPowensInvestmentAssets({ assets, positions })).toEqual([assets[1]])
  })

  it('sums only finite valuations', () => {
    expect(
      sumPowensInvestmentAssetValuations([
        createPowensInvestmentAsset({ valuation: 100 }),
        createPowensInvestmentAsset({ valuation: Number.NaN }),
        createPowensInvestmentAsset({ valuation: 50.25 }),
      ])
    ).toBe(150.25)
  })
})
