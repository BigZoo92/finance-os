import type { AuthMode } from './auth-types'
import type { DashboardSummaryResponse } from './dashboard-types'
import type {
  ExternalInvestmentCashFlow,
  ExternalInvestmentConnection,
  ExternalInvestmentListResponse,
  ExternalInvestmentPosition,
  ExternalInvestmentProvider,
  ExternalInvestmentSummaryResponse,
  ExternalInvestmentTrade,
} from './external-investments/types'

export type FiscalReviewStatus =
  | 'not_applicable'
  | 'to_check'
  | 'likely_relevant'
  | 'missing_data'
  | 'ready_for_review'

export type FiscalFormHint = '3916-3916-bis' | '2086' | '2074' | 'pea-review' | 'other' | 'unknown'

export type FiscalAccountReview = {
  id: string
  label: string
  provider?: string
  accountType: string
  source: 'powens' | 'external-investments' | 'manual' | 'demo' | 'unknown'
  status: FiscalReviewStatus
  formHint?: FiscalFormHint
  reason: string
  missingData: string[]
  nextAction: string
  confidence?: number
  isSensitive?: boolean
}

export type FiscalEventReview = {
  id: string
  year: number
  label: string
  category:
    | 'crypto_disposal'
    | 'security_sale'
    | 'dividend'
    | 'interest'
    | 'pea_withdrawal'
    | 'account_opened_closed'
    | 'unknown'
  source: string
  amount?: number
  currency?: string
  status: FiscalReviewStatus
  formHint?: FiscalFormHint
  reason: string
  missingData: string[]
  nextAction: string
  confidence?: number
  isSensitive?: boolean
}

export type FiscalChecklistStatus =
  | 'todo'
  | 'ready'
  | 'not_applicable'
  | 'missing_data'
  | 'to_confirm'

export type FiscalChecklistItem = {
  id: string
  label: string
  status: FiscalChecklistStatus
  reason?: string
}

export type FiscalExportItem = {
  id: string
  label: string
  format: 'csv' | 'print'
  available: boolean
  reason?: string
}

export type FiscalSummaryViewModel = {
  year: number
  householdContext: {
    status: 'attached_to_parent_household'
    label: string
    description: string
  }
  accounts: FiscalAccountReview[]
  events: FiscalEventReview[]
  missingData: string[]
  checklist: FiscalChecklistItem[]
  exports: FiscalExportItem[]
  meta: {
    mode: AuthMode
    generatedAt: string
    degraded?: boolean
    reason?: string
    redacted: boolean
  }
}

export type BuildFiscalSummaryInput = {
  year: number
  mode: AuthMode
  summary?: DashboardSummaryResponse
  externalSummary?: ExternalInvestmentSummaryResponse
  externalPositions?: ExternalInvestmentListResponse<ExternalInvestmentPosition>
  externalTrades?: ExternalInvestmentListResponse<ExternalInvestmentTrade>
  externalCashFlows?: ExternalInvestmentListResponse<ExternalInvestmentCashFlow>
}

const DEMO_FISCAL_GENERATED_AT = '2026-04-09T12:00:00.000Z'

const FOREIGN_BANK_HINTS = ['revolut', 'wise', 'n26', 'bunq']

const toSearchText = (...parts: Array<string | null | undefined>) =>
  parts
    .filter((part): part is string => Boolean(part))
    .join(' ')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

const unique = (values: string[]) => Array.from(new Set(values.filter(value => value.length > 0)))

const parseYear = (value: string | null | undefined) => {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.getUTCFullYear()
}

const providerLabel = (provider: ExternalInvestmentProvider) =>
  provider === 'ibkr' ? 'IBKR' : 'Binance'

const statusConfidence = (status: FiscalReviewStatus) => {
  if (status === 'ready_for_review') return 0.8
  if (status === 'likely_relevant') return 0.7
  if (status === 'to_check') return 0.55
  if (status === 'missing_data') return 0.35
  return 0.2
}

const isDemoDashboardSummary = (summary: DashboardSummaryResponse | undefined) => {
  if (!summary) return false
  const hasDemoConnections =
    summary.connections.length > 0 &&
    summary.connections.every(connection => connection.powensConnectionId.startsWith('demo-'))
  const hasDemoAccounts =
    summary.accounts.length > 0 &&
    summary.accounts.every(account => account.powensAccountId.startsWith('demo-'))
  return hasDemoConnections && hasDemoAccounts
}

const getUsableSummary = ({
  mode,
  summary,
}: {
  mode: AuthMode
  summary?: DashboardSummaryResponse
}) => {
  if (mode === 'admin' && isDemoDashboardSummary(summary)) {
    return undefined
  }

  return summary
}

const isAdminDemoExternalFallback = ({
  mode,
  source,
}: {
  mode: AuthMode
  source: 'demo_fixture' | 'cache' | undefined
}) => mode === 'admin' && source === 'demo_fixture'

const getExternalConnections = (
  externalSummary: ExternalInvestmentSummaryResponse | undefined
): ExternalInvestmentConnection[] => {
  const connections = externalSummary?.status.connections
  return Array.isArray(connections) ? connections : []
}

const findExternalProviderAccount = (
  accounts: FiscalAccountReview[],
  provider: ExternalInvestmentProvider
) => accounts.find(account => account.provider === providerLabel(provider))

const buildExternalAccountReview = ({
  provider,
  connection,
  positionCount,
  tradeCount,
}: {
  provider: ExternalInvestmentProvider
  connection?: ExternalInvestmentConnection
  positionCount: number
  tradeCount: number
}): FiscalAccountReview => {
  if (provider === 'binance') {
    const missingData = unique([
      'date d ouverture du compte',
      'pays ou entite contractante a confirmer',
      'historique annuel complet des transactions',
      positionCount === 0 && tradeCount === 0 ? 'historique provider absent du cache' : '',
    ])

    const status: FiscalReviewStatus = missingData.length > 2 ? 'missing_data' : 'to_check'
    return {
      id: `external-binance-${connection?.id ?? 'detected'}`,
      label: connection?.accountAlias ?? 'Binance Spot',
      provider: 'Binance',
      accountType: "Compte d'actifs numeriques",
      source: 'external-investments',
      status,
      formHint: '3916-3916-bis',
      reason: "Compte d'actifs numeriques a verifier, notamment si ouvert, detenu, utilise ou clos a l'etranger.",
      missingData,
      nextAction:
        "Exporter l'historique Binance annuel et confirmer l'entite du compte avant toute reprise dans le dossier.",
      confidence: statusConfidence(status),
      isSensitive: true,
    }
  }

  const missingData = unique([
    'date d ouverture du compte',
    'pays ou entite du courtier',
    'releve annuel courtier',
    positionCount === 0 && tradeCount === 0 ? 'positions ou mouvements absents du cache' : '',
  ])
  const status: FiscalReviewStatus = missingData.length > 2 ? 'missing_data' : 'to_check'

  return {
    id: `external-ibkr-${connection?.id ?? 'detected'}`,
    label: connection?.accountAlias ?? 'Compte IBKR Flex',
    provider: 'IBKR',
    accountType: 'Compte titres / courtier etranger',
    source: 'external-investments',
    status,
    formHint: '3916-3916-bis',
    reason: 'Courtier etranger ou compte titres a verifier sans conclure automatiquement.',
    missingData,
    nextAction:
      'Telecharger le releve annuel IBKR et confirmer les informations de compte avant transmission.',
    confidence: statusConfidence(status),
    isSensitive: true,
  }
}

const buildTradeRepublicAccountReview = ({
  id,
  label,
  source,
}: {
  id: string
  label: string
  source: FiscalAccountReview['source']
}): FiscalAccountReview => ({
  id,
  label,
  provider: 'Trade Republic',
  accountType: 'Compte titres / especes a confirmer',
  source,
  status: 'to_check',
  formHint: '3916-3916-bis',
  reason: 'Statut et localisation du compte a confirmer; Finance-OS ne suppose pas la categorie fiscale.',
  missingData: ['pays ou entite contractante', 'date d ouverture', 'releve annuel'],
  nextAction: 'Verifier les documents Trade Republic et la localisation juridique du compte.',
  confidence: statusConfidence('to_check'),
  isSensitive: true,
})

const buildForeignBankAccountReview = ({
  id,
  label,
  provider,
}: {
  id: string
  label: string
  provider: string
}): FiscalAccountReview => ({
  id,
  label,
  provider,
  accountType: 'Compte bancaire ou fintech a verifier',
  source: 'powens',
  status: 'to_check',
  formHint: '3916-3916-bis',
  reason:
    'Compte potentiellement hors France a verifier. La localisation et le statut declaratif ne sont pas deduits avec certitude.',
  missingData: ['pays ou entite du compte', 'date d ouverture', 'date de cloture si applicable'],
  nextAction: 'Comparer avec les documents de la banque et confirmer si le compte est concerne.',
  confidence: statusConfidence('to_check'),
  isSensitive: true,
})

const buildPeaAccountReview = ({
  id,
  label,
  source,
  hasOpeningDate,
}: {
  id: string
  label: string
  source: FiscalAccountReview['source']
  hasOpeningDate: boolean
}): FiscalAccountReview => ({
  id,
  label,
  provider: 'PEA',
  accountType: "Plan d'epargne en actions",
  source,
  status: 'to_check',
  formHint: 'pea-review',
  reason:
    "PEA : verification surtout utile en cas de retrait, rachat ou cloture. Les regles dependent notamment de l'anciennete du plan et des operations realisees.",
  missingData: unique([
    hasOpeningDate ? '' : 'date d ouverture du plan',
    'date du premier versement',
    'historique des retraits, rachats ou cloture',
  ]),
  nextAction:
    "Confirmer l'anciennete du plan et l'absence ou la presence de retrait avec les documents de l'etablissement.",
  confidence: statusConfidence('to_check'),
  isSensitive: true,
})

const collectAccountReviews = ({
  mode,
  summary,
  externalSummary,
  positions,
  trades,
}: {
  mode: AuthMode
  summary?: DashboardSummaryResponse
  externalSummary?: ExternalInvestmentSummaryResponse
  positions: ExternalInvestmentPosition[]
  trades: ExternalInvestmentTrade[]
}) => {
  const accounts: FiscalAccountReview[] = []
  const connections = getExternalConnections(externalSummary)
  const providers = new Set<ExternalInvestmentProvider>([
    ...connections.map(connection => connection.provider),
    ...positions.map(position => position.provider),
    ...trades.map(trade => trade.provider),
  ])

  for (const provider of providers) {
    const connection = connections.find(item => item.provider === provider)
    accounts.push(
      buildExternalAccountReview({
        provider,
        ...(connection ? { connection } : {}),
        positionCount: positions.filter(position => position.provider === provider).length,
        tradeCount: trades.filter(trade => trade.provider === provider).length,
      })
    )
  }

  const accountLikeItems = [
    ...(summary?.accounts.map(account => ({
      id: `powens-${account.powensAccountId}`,
      label: account.name,
      provider: summary.connections.find(
        connection => connection.powensConnectionId === account.powensConnectionId
      )?.providerInstitutionName,
      source: 'powens' as const,
      openedAt: null,
    })) ?? []),
    ...(summary?.assets.map(asset => ({
      id: `asset-${asset.assetId}`,
      label: asset.name,
      provider: asset.providerInstitutionName,
      source: asset.origin === 'manual' ? ('manual' as const) : ('powens' as const),
      openedAt: null,
    })) ?? []),
    ...(summary?.positions.map(position => ({
      id: `position-${position.positionId}`,
      label: position.accountName ?? position.assetName ?? position.name,
      provider: position.provider,
      source: position.source === 'manual' ? ('manual' as const) : ('powens' as const),
      openedAt: position.openedAt,
    })) ?? []),
  ]

  const tradeRepublicItem = accountLikeItems.find(item =>
    toSearchText(item.label, item.provider).includes('trade republic')
  )
  if (tradeRepublicItem) {
    accounts.push(
      buildTradeRepublicAccountReview({
        id: `trade-republic-${tradeRepublicItem.id}`,
        label: tradeRepublicItem.label,
        source: tradeRepublicItem.source,
      })
    )
  }

  const foreignBankItems = accountLikeItems.filter(item => {
    const text = toSearchText(item.label, item.provider)
    return FOREIGN_BANK_HINTS.some(hint => text.includes(hint))
  })
  for (const item of foreignBankItems) {
    accounts.push(
      buildForeignBankAccountReview({
        id: `foreign-bank-${item.id}`,
        label: item.label,
        provider: item.provider ?? item.label,
      })
    )
  }

  const peaItem = accountLikeItems.find(item => toSearchText(item.label).includes('pea'))
  if (peaItem) {
    accounts.push(
      buildPeaAccountReview({
        id: `pea-${peaItem.id}`,
        label: peaItem.label,
        source: peaItem.source,
        hasOpeningDate: Boolean(peaItem.openedAt),
      })
    )
  }

  if (mode === 'demo' && !findExternalProviderAccount(accounts, 'binance')) {
    accounts.push(
      buildExternalAccountReview({
        provider: 'binance',
        positionCount: 0,
        tradeCount: 0,
      })
    )
  }

  if (mode === 'demo' && !findExternalProviderAccount(accounts, 'ibkr')) {
    accounts.push(
      buildExternalAccountReview({
        provider: 'ibkr',
        positionCount: 0,
        tradeCount: 0,
      })
    )
  }

  return accounts
}

const missingTradeData = (trade: ExternalInvestmentTrade) =>
  unique([
    trade.quantity === null ? 'quantite' : '',
    trade.price === null ? 'prix unitaire' : '',
    trade.netAmount === null && trade.grossAmount === null ? 'prix de cession' : '',
    trade.feeAmount === null ? 'frais' : '',
    trade.sourceConfidence === 'low' || trade.sourceConfidence === 'unknown'
      ? 'confiance de source'
      : '',
  ])

const buildTradeEvent = (trade: ExternalInvestmentTrade, year: number): FiscalEventReview => {
  const missingData = unique([
    ...missingTradeData(trade),
    trade.provider === 'binance' ? 'prix d acquisition' : 'prix de revient / cout de revient',
    trade.provider === 'binance' ? 'historique des echanges crypto' : 'releve annuel courtier',
  ])
  const status: FiscalReviewStatus =
    missingData.length > 0 ? 'missing_data' : 'ready_for_review'
  const isCrypto = trade.provider === 'binance'
  const amount = trade.netAmount ?? trade.grossAmount

  return {
    id: `trade-${trade.provider}-${trade.id}`,
    year,
    label: `${providerLabel(trade.provider)} - ${trade.symbol ?? 'instrument inconnu'} vendu`,
    category: isCrypto ? 'crypto_disposal' : 'security_sale',
    source: providerLabel(trade.provider),
    ...(amount !== null ? { amount } : {}),
    ...(trade.currency ? { currency: trade.currency } : {}),
    status,
    formHint: isCrypto ? '2086' : '2074',
    reason: isCrypto
      ? 'Cession crypto potentiellement concernee par une verification 2086 si elle correspond a une cession imposable.'
      : 'Vente de titres CTO potentiellement concernee par une verification 2074 selon les releves du courtier.',
    missingData,
    nextAction: isCrypto
      ? "Reconstituer prix d'acquisition, prix de cession, frais et horodatage avant tout calcul."
      : "Comparer avec le releve fiscal annuel du courtier et verifier le cout de revient.",
    confidence: statusConfidence(status),
    isSensitive: true,
  }
}

const buildCashFlowEvent = (
  flow: ExternalInvestmentCashFlow,
  year: number
): FiscalEventReview => {
  const isDividend = flow.type === 'dividend'
  const missingData = unique([
    flow.amount === null ? 'montant brut/net' : '',
    flow.currency === null ? 'devise' : '',
    flow.feeAmount === null ? 'frais ou retenue a la source si applicable' : '',
    'releve annuel provider',
  ])
  const status: FiscalReviewStatus = missingData.length > 1 ? 'missing_data' : 'to_check'

  return {
    id: `cash-flow-${flow.provider}-${flow.id}`,
    year,
    label: `${providerLabel(flow.provider)} - ${isDividend ? 'dividende' : 'interet'} a verifier`,
    category: isDividend ? 'dividend' : 'interest',
    source: providerLabel(flow.provider),
    ...(flow.amount !== null ? { amount: flow.amount } : {}),
    ...(flow.currency ? { currency: flow.currency } : {}),
    status,
    formHint: '2074',
    reason: isDividend
      ? 'Dividende detecte dans les donnees disponibles; a rapprocher du releve annuel.'
      : 'Interet detecte dans les donnees disponibles; a rapprocher du releve annuel.',
    missingData,
    nextAction: 'Verifier le releve annuel et les montants repris par le foyer fiscal.',
    confidence: statusConfidence(status),
    isSensitive: true,
  }
}

const buildCryptoHistoryWarning = (year: number): FiscalEventReview => ({
  id: 'crypto-history-missing',
  year,
  label: 'Historique Binance a verifier avant toute synthese 2086',
  category: 'crypto_disposal',
  source: 'Binance',
  status: 'missing_data',
  formHint: '2086',
  reason:
    "Donnees insuffisantes pour confirmer l'absence ou le detail de cessions crypto sur l'annee.",
  missingData: [
    'prix d acquisition',
    'prix de cession',
    'horodatages complets',
    'frais',
    'historique des echanges',
  ],
  nextAction: "Exporter l'historique annuel complet depuis Binance avant de conclure.",
  confidence: statusConfidence('missing_data'),
  isSensitive: true,
})

const buildSecurityHistoryWarning = (year: number): FiscalEventReview => ({
  id: 'security-history-missing',
  year,
  label: 'Ventes CTO / titres a confirmer avec le releve annuel',
  category: 'security_sale',
  source: 'IBKR',
  status: 'to_check',
  formHint: '2074',
  reason:
    "Aucune vente CTO fiable n'est suffisante dans le cache; le releve annuel du courtier reste la reference a verifier.",
  missingData: ['releve annuel courtier', 'cout de revient', 'historique des ventes'],
  nextAction: 'Telecharger le releve fiscal annuel et verifier les cessions de titres.',
  confidence: statusConfidence('to_check'),
  isSensitive: true,
})

const buildPeaWithdrawalReview = (year: number, pea: FiscalAccountReview): FiscalEventReview => ({
  id: 'pea-withdrawal-review',
  year,
  label: `${pea.label} - retrait, rachat ou cloture a verifier`,
  category: 'pea_withdrawal',
  source: pea.source === 'manual' ? 'Manuel' : 'Powens',
  status: 'to_check',
  formHint: 'pea-review',
  reason:
    "Verification utile surtout en cas de retrait, rachat ou cloture. Finance-OS ne calcule pas le traitement fiscal du PEA.",
  missingData: unique(['date du premier versement', ...pea.missingData]),
  nextAction: "Confirmer les retraits ou cloture avec l'etablissement qui tient le PEA.",
  confidence: statusConfidence('to_check'),
  isSensitive: true,
})

const buildAccountLifecycleEvent = (
  year: number,
  account: FiscalAccountReview
): FiscalEventReview => ({
  id: `account-lifecycle-${account.id}`,
  year,
  label: `${account.provider ?? account.label} - ouverture, usage ou cloture a confirmer`,
  category: 'account_opened_closed',
  source: account.provider ?? account.source,
  status: account.status === 'missing_data' ? 'missing_data' : 'to_check',
  formHint: account.formHint ?? 'unknown',
  reason: "Les dates d'ouverture, d'utilisation ou de cloture peuvent etre utiles au dossier preparatoire.",
  missingData: account.missingData.filter(item =>
    toSearchText(item).includes('date') || toSearchText(item).includes('pays')
  ),
  nextAction: account.nextAction,
  ...(account.confidence !== undefined ? { confidence: account.confidence } : {}),
  ...(account.isSensitive !== undefined ? { isSensitive: account.isSensitive } : {}),
})

const collectEventReviews = ({
  year,
  accounts,
  positions,
  trades,
  cashFlows,
}: {
  year: number
  accounts: FiscalAccountReview[]
  positions: ExternalInvestmentPosition[]
  trades: ExternalInvestmentTrade[]
  cashFlows: ExternalInvestmentCashFlow[]
}) => {
  const events: FiscalEventReview[] = []

  for (const trade of trades) {
    if (parseYear(trade.tradedAt) !== year) continue
    if (trade.side === 'sell') {
      events.push(buildTradeEvent(trade, year))
      continue
    }

    if (trade.side === 'unknown') {
      events.push({
        id: `trade-unknown-${trade.provider}-${trade.id}`,
        year,
        label: `${providerLabel(trade.provider)} - mouvement de nature inconnue`,
        category: 'unknown',
        source: providerLabel(trade.provider),
        status: 'missing_data',
        formHint: 'unknown',
        reason: 'Mouvement incomplet: Finance-OS ne sait pas le qualifier sans historique provider.',
        missingData: ['nature du mouvement', 'montant', 'releve annuel provider'],
        nextAction: 'Verifier le mouvement dans le releve officiel du provider.',
        confidence: statusConfidence('missing_data'),
        isSensitive: true,
      })
    }
  }

  for (const flow of cashFlows) {
    if (parseYear(flow.occurredAt) !== year) continue
    if (flow.type === 'dividend' || flow.type === 'interest') {
      events.push(buildCashFlowEvent(flow, year))
    }
  }

  const hasBinanceAccount = Boolean(findExternalProviderAccount(accounts, 'binance'))
  const hasCryptoPosition = positions.some(
    position =>
      position.provider === 'binance' &&
      (position.assetClass === 'crypto' || position.assetClass === 'stablecoin')
  )
  const hasCryptoSell = events.some(event => event.category === 'crypto_disposal')
  if (hasBinanceAccount && hasCryptoPosition && !hasCryptoSell) {
    events.push(buildCryptoHistoryWarning(year))
  }

  const hasIbkrAccount = Boolean(findExternalProviderAccount(accounts, 'ibkr'))
  const hasSecuritySell = events.some(event => event.category === 'security_sale')
  if (hasIbkrAccount && !hasSecuritySell) {
    events.push(buildSecurityHistoryWarning(year))
  }

  const pea = accounts.find(account => account.formHint === 'pea-review')
  if (pea) {
    events.push(buildPeaWithdrawalReview(year, pea))
  }

  for (const account of accounts.filter(item => item.formHint === '3916-3916-bis')) {
    events.push(buildAccountLifecycleEvent(year, account))
  }

  return events
}

const collectMissingData = ({
  accounts,
  events,
  externalSummary,
}: {
  accounts: FiscalAccountReview[]
  events: FiscalEventReview[]
  externalSummary?: ExternalInvestmentSummaryResponse
}) => {
  const providerWarnings = externalSummary?.bundle
    ? [
        ...externalSummary.bundle.unknownCostBasisWarnings,
        ...externalSummary.bundle.missingMarketDataWarnings,
        ...externalSummary.bundle.staleDataWarnings,
        ...externalSummary.bundle.fxAssumptions,
      ]
    : []

  return unique([
    ...accounts.flatMap(account => account.missingData),
    ...events.flatMap(event => event.missingData),
    ...providerWarnings,
    'elements a confirmer avec le foyer fiscal de rattachement',
  ])
}

const hasStatus = (items: Array<{ status: FiscalReviewStatus }>, status: FiscalReviewStatus) =>
  items.some(item => item.status === status)

const buildChecklist = ({
  accounts,
  events,
}: {
  accounts: FiscalAccountReview[]
  events: FiscalEventReview[]
}): FiscalChecklistItem[] => {
  const foreignAccounts = accounts.filter(account => account.formHint === '3916-3916-bis')
  const cryptoEvents = events.filter(event => event.category === 'crypto_disposal')
  const securityEvents = events.filter(event => event.category === 'security_sale')
  const incomeEvents = events.filter(
    event => event.category === 'dividend' || event.category === 'interest'
  )
  const peaEvents = events.filter(event => event.category === 'pea_withdrawal')

  return [
    {
      id: 'foreign-accounts',
      label: 'Verifier les comptes et comptes d actifs numeriques potentiellement etrangers',
      status:
        foreignAccounts.length === 0
          ? 'not_applicable'
          : hasStatus(foreignAccounts, 'missing_data')
            ? 'missing_data'
            : 'to_confirm',
      reason:
        foreignAccounts.length === 0
          ? 'Aucun compte etranger detecte dans les donnees disponibles.'
          : 'Les indices 3916 / 3916-bis restent des points a verifier, pas une conclusion officielle.',
    },
    {
      id: 'binance',
      label: 'Verifier Binance et les comptes d actifs numeriques',
      status: accounts.some(account => account.provider === 'Binance') ? 'missing_data' : 'not_applicable',
      reason: accounts.some(account => account.provider === 'Binance')
        ? 'Historique, entite et dates du compte a confirmer.'
        : 'Aucun compte Binance detecte.',
    },
    {
      id: 'ibkr',
      label: 'Verifier IBKR et le releve annuel courtier',
      status: accounts.some(account => account.provider === 'IBKR') ? 'to_confirm' : 'not_applicable',
      reason: accounts.some(account => account.provider === 'IBKR')
        ? 'Courtier etranger ou CTO a rapprocher du releve annuel.'
        : 'Aucun compte IBKR detecte.',
    },
    {
      id: 'trade-republic',
      label: 'Confirmer le statut et la localisation Trade Republic si present',
      status: accounts.some(account => account.provider === 'Trade Republic')
        ? 'to_confirm'
        : 'not_applicable',
      reason: accounts.some(account => account.provider === 'Trade Republic')
        ? 'Finance-OS ne suppose pas la localisation fiscale du compte.'
        : 'Aucun compte Trade Republic detecte.',
    },
    {
      id: 'crypto-disposals',
      label: 'Controler les cessions crypto et les donnees 2086 a preparer',
      status:
        cryptoEvents.length === 0
          ? 'not_applicable'
          : hasStatus(cryptoEvents, 'missing_data')
            ? 'missing_data'
            : 'ready',
      reason:
        cryptoEvents.length === 0
          ? 'Aucune cession crypto detectee dans le cache.'
          : 'Les evenements crypto demandent une verification avant tout calcul.',
    },
    {
      id: 'security-sales',
      label: 'Controler les ventes CTO / titres et les donnees 2074 a preparer',
      status:
        securityEvents.length === 0
          ? 'not_applicable'
          : hasStatus(securityEvents, 'missing_data')
            ? 'missing_data'
            : 'to_confirm',
      reason:
        securityEvents.length === 0
          ? 'Aucune vente de titres detectee dans les donnees disponibles.'
          : 'Le releve annuel courtier reste a comparer.',
    },
    {
      id: 'dividends-interest',
      label: 'Verifier dividendes et interets',
      status: incomeEvents.length > 0 ? 'to_confirm' : 'not_applicable',
      reason:
        incomeEvents.length > 0
          ? 'Montants a rapprocher des releves provider.'
          : 'Aucun dividende ou interet detecte dans le cache.',
    },
    {
      id: 'pea',
      label: 'Verifier retrait, rachat ou cloture PEA',
      status: peaEvents.length > 0 ? 'to_confirm' : 'not_applicable',
      reason:
        peaEvents.length > 0
          ? "Le PEA est traite prudemment; l'anciennete et les operations doivent etre confirmees."
          : 'Aucun PEA detecte dans les donnees disponibles.',
    },
    {
      id: 'exports',
      label: 'Exporter les releves provider et archiver le dossier personnel',
      status: accounts.length > 0 || events.length > 0 ? 'todo' : 'not_applicable',
      reason:
        accounts.length > 0 || events.length > 0
          ? 'Dossier preparatoire a verifier ou transmettre au foyer fiscal.'
          : 'Aucune donnee exploitable a exporter.',
    },
  ]
}

const buildExports = ({
  accounts,
  events,
}: {
  accounts: FiscalAccountReview[]
  events: FiscalEventReview[]
}): FiscalExportItem[] => [
  {
    id: 'accounts-csv',
    label: 'Exporter la checklist',
    format: 'csv',
    available: accounts.length > 0,
    reason:
      accounts.length > 0
        ? 'Document preparatoire a verifier.'
        : 'Aucun compte a exporter dans les donnees disponibles.',
  },
  {
    id: 'events-csv',
    label: 'Exporter les evenements',
    format: 'csv',
    available: events.length > 0,
    reason:
      events.length > 0
        ? 'Document preparatoire a verifier.'
        : 'Aucun evenement a exporter dans les donnees disponibles.',
  },
  {
    id: 'print',
    label: 'Imprimer le dossier preparatoire',
    format: 'print',
    available: true,
    reason: 'Document preparatoire a verifier.',
  },
]

export const buildFiscalSummaryViewModel = ({
  year,
  mode,
  summary,
  externalSummary,
  externalPositions,
  externalTrades,
  externalCashFlows,
}: BuildFiscalSummaryInput): FiscalSummaryViewModel => {
  const usableSummary = getUsableSummary({ mode, ...(summary ? { summary } : {}) })
  const externalFallback = isAdminDemoExternalFallback({
    mode,
    source: externalSummary?.source,
  })
  const positionsFallback = isAdminDemoExternalFallback({
    mode,
    source: externalPositions?.source,
  })
  const tradesFallback = isAdminDemoExternalFallback({
    mode,
    source: externalTrades?.source,
  })
  const cashFlowsFallback = isAdminDemoExternalFallback({
    mode,
    source: externalCashFlows?.source,
  })
  const dashboardFallback = mode === 'admin' && isDemoDashboardSummary(summary)

  const usableExternalSummary = externalFallback ? undefined : externalSummary
  const positions = positionsFallback ? [] : (externalPositions?.items ?? [])
  const trades = tradesFallback ? [] : (externalTrades?.items ?? [])
  const cashFlows = cashFlowsFallback ? [] : (externalCashFlows?.items ?? [])

  const accounts = collectAccountReviews({
    mode,
    ...(usableSummary ? { summary: usableSummary } : {}),
    ...(usableExternalSummary ? { externalSummary: usableExternalSummary } : {}),
    positions,
    trades,
  })
  const events = collectEventReviews({ year, accounts, positions, trades, cashFlows })
  const missingData = collectMissingData({
    accounts,
    events,
    ...(usableExternalSummary ? { externalSummary: usableExternalSummary } : {}),
  })
  const generatedAt =
    mode === 'demo'
      ? DEMO_FISCAL_GENERATED_AT
      : (usableExternalSummary?.generatedAt ??
        usableExternalSummary?.latestBundleMeta?.generatedAt ??
        new Date().toISOString())
  const degraded = externalFallback || positionsFallback || tradesFallback || cashFlowsFallback || dashboardFallback
  const reason = degraded
    ? 'Certaines lectures admin sont indisponibles ou ressemblent a des fixtures demo; elles sont exclues du dossier fiscal.'
    : undefined

  return {
    year,
    householdContext: {
      status: 'attached_to_parent_household',
      label: 'Rattache au foyer fiscal de ta mere',
      description:
        "Finance-OS prepare un dossier personnel a verifier ou transmettre, mais ne calcule pas l'impot complet du foyer.",
    },
    accounts,
    events,
    missingData,
    checklist: buildChecklist({ accounts, events }),
    exports: buildExports({ accounts, events }),
    meta: {
      mode,
      generatedAt,
      ...(degraded ? { degraded: true } : {}),
      ...(reason ? { reason } : {}),
      redacted: true,
    },
  }
}

const sanitizeCsvCell = (value: string | number | null) => {
  const text = value === null ? '' : String(value)
  return `"${text.replaceAll('"', '""')}"`
}

export const buildFiscalAccountsCsv = (accounts: FiscalAccountReview[]) => {
  const header = [
    'label',
    'provider',
    'accountType',
    'source',
    'status',
    'formHint',
    'reason',
    'missingData',
    'nextAction',
    'document',
  ]
  const rows = accounts.map(account =>
    [
      account.label,
      account.provider ?? '',
      account.accountType,
      account.source,
      account.status,
      account.formHint ?? '',
      account.reason,
      account.missingData.join(' | '),
      account.nextAction,
      'Document preparatoire a verifier.',
    ]
      .map(sanitizeCsvCell)
      .join(',')
  )
  return [header.join(','), ...rows].join('\n')
}

export const buildFiscalEventsCsv = (events: FiscalEventReview[]) => {
  const header = [
    'year',
    'label',
    'category',
    'source',
    'amount',
    'currency',
    'status',
    'formHint',
    'reason',
    'missingData',
    'nextAction',
    'document',
  ]
  const rows = events.map(event =>
    [
      event.year,
      event.label,
      event.category,
      event.source,
      event.amount ?? '',
      event.currency ?? '',
      event.status,
      event.formHint ?? '',
      event.reason,
      event.missingData.join(' | '),
      event.nextAction,
      'Document preparatoire a verifier.',
    ]
      .map(value => sanitizeCsvCell(value === '' ? null : value))
      .join(',')
  )
  return [header.join(','), ...rows].join('\n')
}
