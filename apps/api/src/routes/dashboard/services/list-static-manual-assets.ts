import type { AssetRow } from '../types'

const STATIC_MANUAL_ASSETS: AssetRow[] = [
  {
    assetId: -1001,
    assetType: 'manual',
    origin: 'manual',
    source: 'manual',
    provider: null,
    providerConnectionId: null,
    providerInstitutionName: null,
    powensConnectionId: null,
    powensAccountId: null,
    name: 'Residence principale',
    currency: 'EUR',
    valuation: '285000',
    valuationAsOf: null,
    enabled: true,
    metadata: {
      note: 'Estimation statique hors provider',
      category: 'real_estate',
    },
  },
  {
    assetId: -1002,
    assetType: 'manual',
    origin: 'manual',
    source: 'manual',
    provider: null,
    providerConnectionId: null,
    providerInstitutionName: null,
    powensConnectionId: null,
    powensAccountId: null,
    name: 'PEA - titres non connectes',
    currency: 'EUR',
    valuation: '41500',
    valuationAsOf: null,
    enabled: true,
    metadata: {
      note: 'Valorisation manuelle',
      category: 'equity',
    },
  },
]

export const listStaticManualAssets = async (): Promise<AssetRow[]> => {
  return STATIC_MANUAL_ASSETS
}
