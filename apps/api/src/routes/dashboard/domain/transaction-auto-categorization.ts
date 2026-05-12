export type TransactionResolutionSource =
  | 'manual_override'
  | 'merchant_rules'
  | 'mcc'
  | 'counterparty'
  | 'fallback'

interface TransactionAutoCategorizationInput {
  label: string
  amount: number
  powensAccountId: string
  accountName: string | null
  merchant: string
  providerCategory: string | null
  customCategory: string | null
  customSubcategory: string | null
  category: string | null
  subcategory: string | null
  incomeType: 'salary' | 'recurring' | 'exceptional' | null
}

interface CategorizationRule {
  id: string
  priority: number
  when: {
    merchantIncludes?: string[]
    labelIncludes?: string[]
    accountIncludes?: string[]
    amountSign?: 'income' | 'expense'
    minAmount?: number
    maxAmount?: number
  }
  assign: {
    category: string
    subcategory?: string
    incomeType?: 'salary' | 'recurring' | 'exceptional'
  }
}

export interface ResolutionTraceStep {
  source: TransactionResolutionSource
  rank: number
  matched: boolean
  reason: string
  category: string | null
  subcategory: string | null
  ruleId: string | null
}

export interface TransactionAutoCategorizationResult {
  category: string | null
  subcategory: string | null
  incomeType: 'salary' | 'recurring' | 'exceptional' | null
  resolvedCategory: string | null
  resolutionTrace: ResolutionTraceStep[]
  resolutionSource: TransactionResolutionSource
  resolutionRuleId: string | null
}

const PRECEDENCE: TransactionResolutionSource[] = [
  'manual_override',
  'merchant_rules',
  'mcc',
  'counterparty',
  'fallback',
]

const MERCHANT_RULES: CategorizationRule[] = [
  // ── Subscriptions / digital services ──────────────────────────────────────
  {
    id: 'merchant-streaming',
    priority: 120,
    when: {
      amountSign: 'expense',
      merchantIncludes: [
        'spotify',
        'netflix',
        'disney',
        'prime video',
        'apple.com/bill',
        'apple music',
        'youtube premium',
        'deezer',
        'canal',
        'molotov',
      ],
    },
    assign: { category: 'Abonnements', subcategory: 'Streaming' },
  },
  {
    id: 'merchant-cloud-tools',
    priority: 121,
    when: {
      amountSign: 'expense',
      merchantIncludes: [
        'icloud',
        'google one',
        'dropbox',
        'github',
        'openai',
        'anthropic',
        'cursor',
        'notion',
        'figma',
        'linear',
      ],
    },
    assign: { category: 'Abonnements', subcategory: 'Logiciels' },
  },
  // ── Groceries ─────────────────────────────────────────────────────────────
  {
    id: 'merchant-groceries',
    priority: 110,
    when: {
      amountSign: 'expense',
      merchantIncludes: [
        'carrefour',
        'monoprix',
        'auchan',
        'lidl',
        'leclerc',
        'super u',
        'intermarche',
        'casino',
        'franprix',
        'picard',
        'biocoop',
        'naturalia',
        'g20',
        'sumup', // FR: small merchants commonly use SumUp; surface under groceries with low priority so a more specific rule wins
      ],
      minAmount: 3,
    },
    assign: { category: 'Courses', subcategory: 'Supermarche' },
  },
  // ── Restaurants / sorties ─────────────────────────────────────────────────
  {
    id: 'merchant-restaurant',
    priority: 115,
    when: {
      amountSign: 'expense',
      merchantIncludes: [
        'restaurant',
        'crêperie',
        'creperie',
        'brasserie',
        'bistrot',
        'pizzeria',
        'kebab',
        'mcdonald',
        'burger king',
        'kfc',
        'starbucks',
        'paul',
        'boulangerie',
        'patisserie',
        'gourmandise',
        'gourmandises',
        'deliveroo',
        'uber eats',
        'just eat',
      ],
    },
    assign: { category: 'Restaurant', subcategory: 'Sorties' },
  },
  // ── Transport / mobility ──────────────────────────────────────────────────
  {
    id: 'merchant-mobility-shared',
    priority: 116,
    when: {
      amountSign: 'expense',
      merchantIncludes: ['lime', 'dott', 'tier', 'voi', 'cityscoot', 'velib', 'bicloo'],
    },
    assign: { category: 'Transport', subcategory: 'Mobilite partagee' },
  },
  {
    id: 'merchant-mobility-rideshare',
    priority: 117,
    when: {
      amountSign: 'expense',
      merchantIncludes: ['uber', 'bolt', 'heetch', 'kapten', 'free now', 'blablacar', 'blablacab'],
    },
    assign: { category: 'Transport', subcategory: 'VTC' },
  },
  {
    id: 'merchant-mobility-public',
    priority: 118,
    when: {
      amountSign: 'expense',
      merchantIncludes: ['sncf', 'ratp', 'navigo', 'flixbus', 'ouigo', 'tgv', 'eurostar', 'thalys'],
    },
    assign: { category: 'Transport', subcategory: 'Train et bus' },
  },
  {
    id: 'merchant-fuel',
    priority: 119,
    when: {
      amountSign: 'expense',
      merchantIncludes: ['total', 'totalenergies', 'shell', 'bp', 'esso', 'station service'],
    },
    assign: { category: 'Transport', subcategory: 'Carburant' },
  },
  // ── Utilities / housing ───────────────────────────────────────────────────
  {
    id: 'merchant-utilities',
    priority: 112,
    when: {
      amountSign: 'expense',
      merchantIncludes: ['edf', 'engie', 'enedis', 'veolia', 'suez', 'eau de paris'],
    },
    assign: { category: 'Logement', subcategory: 'Energie et eau' },
  },
  {
    id: 'merchant-telco',
    priority: 113,
    when: {
      amountSign: 'expense',
      merchantIncludes: ['free mobile', 'orange', 'sfr', 'bouygues', 'sosh', 'red by sfr', 'lyca'],
    },
    assign: { category: 'Abonnements', subcategory: 'Telecom' },
  },
  // ── Bank fees ─────────────────────────────────────────────────────────────
  {
    id: 'merchant-bank-fees-checking',
    priority: 130,
    when: {
      amountSign: 'expense',
      accountIncludes: ['courant', 'checking'],
      labelIncludes: ['frais', 'commission', 'cotisation'],
      maxAmount: 60,
    },
    assign: { category: 'Frais bancaires' },
  },
  // ── Health ────────────────────────────────────────────────────────────────
  {
    id: 'merchant-health',
    priority: 114,
    when: {
      amountSign: 'expense',
      merchantIncludes: ['doctolib', 'pharmacie', 'cpam', 'mutuelle', 'opticien', 'hopital'],
    },
    assign: { category: 'Sante' },
  },
  // ── Shopping (broad) ──────────────────────────────────────────────────────
  {
    id: 'merchant-shopping-broad',
    priority: 105,
    when: {
      amountSign: 'expense',
      merchantIncludes: [
        'amazon',
        'fnac',
        'darty',
        'decathlon',
        'leroy merlin',
        'castorama',
        'ikea',
      ],
    },
    assign: { category: 'Achats divers' },
  },
  // ── Gaming / digital entertainment ───────────────────────────────────────
  {
    id: 'merchant-gaming',
    priority: 122,
    when: {
      amountSign: 'expense',
      merchantIncludes: [
        'steam',
        'steamgames',
        'epicgames',
        'epic games',
        'gog.com',
        'nintendo',
        'playstation',
        'xbox',
        'ubisoft',
        'ea.com',
      ],
    },
    assign: { category: 'Loisirs', subcategory: 'Jeux video' },
  },
  // ── Bakery / café variants common in FR statements ───────────────────────
  {
    id: 'merchant-bakery-cafe-extra',
    priority: 116,
    when: {
      amountSign: 'expense',
      merchantIncludes: [
        'la parisienne',
        'aubrac corner',
        'smoked meat',
        'comptoir',
        'croissanterie',
        'paul boulanger',
      ],
    },
    assign: { category: 'Restaurant', subcategory: 'Sorties' },
  },
]

const COUNTERPARTY_RULES: CategorizationRule[] = [
  // ── Broker transfers (highest priority — NOT consumer spending) ───────────
  // Outgoing transfers to investment brokers. These must NOT be aggregated as
  // consumer spending; downstream aggregates filter on category=Investissement.
  {
    id: 'broker-transfer-ibkr',
    priority: 140,
    when: {
      amountSign: 'expense',
      labelIncludes: ['ibkr', 'interactive brokers'],
    },
    assign: { category: 'Investissement', subcategory: 'Transfert vers courtier' },
  },
  {
    id: 'broker-transfer-binance',
    priority: 140,
    when: {
      amountSign: 'expense',
      labelIncludes: ['binance'],
    },
    assign: { category: 'Investissement', subcategory: 'Transfert vers exchange crypto' },
  },
  {
    id: 'broker-transfer-trade-republic',
    priority: 140,
    when: {
      amountSign: 'expense',
      labelIncludes: ['trade republic', 'trade re ', 'traderepublic'],
    },
    assign: { category: 'Investissement', subcategory: 'Transfert vers courtier' },
  },
  {
    id: 'broker-transfer-other-courtiers',
    priority: 140,
    when: {
      amountSign: 'expense',
      labelIncludes: [
        'bourse direct',
        'degiro',
        'saxo',
        'etoro',
        'fortuneo bourse',
        'boursorama bourse',
      ],
    },
    assign: { category: 'Investissement', subcategory: 'Transfert vers courtier' },
  },
  {
    id: 'broker-pea-order',
    priority: 141,
    when: {
      amountSign: 'expense',
      labelIncludes: ['ordre achat', 'ordre vente', 'ordre bourse', 'msci world', 'cw8', 'pea'],
    },
    assign: { category: 'Investissement', subcategory: 'Ordre bourse' },
  },
  // ── Incoming broker transfers (cash returned from a broker) ──────────────
  {
    id: 'broker-transfer-incoming',
    priority: 140,
    when: {
      amountSign: 'income',
      labelIncludes: ['ibkr', 'binance', 'trade republic', 'traderepublic'],
    },
    assign: { category: 'Investissement', subcategory: 'Retour de courtier' },
  },
  {
    id: 'counterparty-salary',
    priority: 100,
    when: {
      amountSign: 'income',
      labelIncludes: ['salaire', 'payroll', 'paie'],
    },
    assign: { category: 'Revenus', subcategory: 'Salaire', incomeType: 'salary' },
  },
  {
    id: 'counterparty-transport-label',
    priority: 90,
    when: {
      amountSign: 'expense',
      labelIncludes: ['sncf', 'ratp', 'uber', 'bolt', 'navigo', 'flixbus'],
    },
    assign: { category: 'Transport' },
  },
  {
    id: 'counterparty-transfer-internal',
    priority: 80,
    when: {
      amountSign: 'expense',
      labelIncludes: ['virement vers', 'virement interne', 'transfer to'],
    },
    assign: { category: 'Transfert interne' },
  },
  {
    id: 'counterparty-refund',
    priority: 85,
    when: {
      amountSign: 'income',
      labelIncludes: ['remboursement', 'refund', 'avoir'],
    },
    assign: { category: 'Revenus', subcategory: 'Remboursement', incomeType: 'exceptional' },
  },
  {
    id: 'counterparty-rent',
    priority: 95,
    when: {
      amountSign: 'expense',
      labelIncludes: ['loyer', 'foncia', 'orpi', 'nexity', 'rent'],
    },
    assign: { category: 'Logement', subcategory: 'Loyer' },
  },
  {
    id: 'counterparty-tax',
    priority: 96,
    when: {
      amountSign: 'expense',
      labelIncludes: ['dgfip', 'impots', 'taxe', 'urssaf', 'tresor public'],
    },
    assign: { category: 'Impots et taxes' },
  },
  // ── Health labels not caught by merchant rules ──────────────────────────
  {
    id: 'counterparty-doctor',
    priority: 92,
    when: {
      amountSign: 'expense',
      labelIncludes: ['docteur ', 'dr ', 'medecin', 'chirurgien', 'dentiste', 'kinesith'],
    },
    assign: { category: 'Sante' },
  },
  // ── Wero / instant peer transfers ────────────────────────────────────────
  {
    id: 'counterparty-wero-person',
    priority: 88,
    when: {
      labelIncludes: ['wero'],
    },
    assign: { category: 'Transfert interne', subcategory: 'Virement entre particuliers' },
  },
]

const normalizeText = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

const amountDirection = (amount: number) => (amount >= 0 ? 'income' : 'expense')

const isUnknownCategory = (value: string | null) => !value || value === 'Unknown'

const matchesRule = (
  rule: CategorizationRule,
  input: {
    normalizedLabel: string
    normalizedAccount: string
    normalizedMerchant: string
    amount: number
  }
) => {
  const direction = amountDirection(input.amount)

  if (rule.when.amountSign && direction !== rule.when.amountSign) {
    return false
  }

  const absoluteAmount = Math.abs(input.amount)
  if (typeof rule.when.minAmount === 'number' && absoluteAmount < rule.when.minAmount) {
    return false
  }

  if (typeof rule.when.maxAmount === 'number' && absoluteAmount > rule.when.maxAmount) {
    return false
  }

  if (
    rule.when.labelIncludes &&
    !rule.when.labelIncludes.some(part => input.normalizedLabel.includes(normalizeText(part)))
  ) {
    return false
  }

  if (
    rule.when.merchantIncludes &&
    !rule.when.merchantIncludes.some(part => input.normalizedMerchant.includes(normalizeText(part)))
  ) {
    return false
  }

  if (
    rule.when.accountIncludes &&
    !rule.when.accountIncludes.some(part => input.normalizedAccount.includes(normalizeText(part)))
  ) {
    return false
  }

  return true
}

const selectBestRule = (matches: CategorizationRule[]) => {
  return (
    [...matches].sort((left, right) => {
      if (left.priority !== right.priority) {
        return right.priority - left.priority
      }
      return left.id.localeCompare(right.id)
    })[0] ?? null
  )
}

const withTraceStep = (
  trace: ResolutionTraceStep[],
  source: TransactionResolutionSource,
  matched: boolean,
  reason: string,
  category: string | null,
  subcategory: string | null,
  ruleId: string | null
) => {
  const rank = PRECEDENCE.indexOf(source) + 1
  trace.push({ source, rank, matched, reason, category, subcategory, ruleId })
}

export const applyTransactionAutoCategorization = (
  input: TransactionAutoCategorizationInput
): TransactionAutoCategorizationResult => {
  const trace: ResolutionTraceStep[] = []

  if (!isUnknownCategory(input.customCategory)) {
    withTraceStep(
      trace,
      'manual_override',
      true,
      'custom_category_present',
      input.customCategory,
      input.customSubcategory,
      null
    )

    return {
      category: input.customCategory,
      subcategory: input.customSubcategory,
      incomeType: input.incomeType,
      resolvedCategory: input.customCategory,
      resolutionTrace: trace,
      resolutionSource: 'manual_override',
      resolutionRuleId: null,
    }
  }

  withTraceStep(trace, 'manual_override', false, 'no_manual_override', null, null, null)

  const normalizedLabel = normalizeText(input.label)
  const normalizedMerchant = normalizeText(input.merchant)
  const normalizedAccount = normalizeText(input.accountName ?? input.powensAccountId)

  const merchantRule = selectBestRule(
    MERCHANT_RULES.filter(rule =>
      matchesRule(rule, {
        normalizedLabel,
        normalizedAccount,
        normalizedMerchant,
        amount: input.amount,
      })
    )
  )

  if (merchantRule) {
    withTraceStep(
      trace,
      'merchant_rules',
      true,
      'matched_merchant_rule',
      merchantRule.assign.category,
      merchantRule.assign.subcategory ?? input.subcategory,
      merchantRule.id
    )

    return {
      category: merchantRule.assign.category,
      subcategory: merchantRule.assign.subcategory ?? input.subcategory,
      incomeType: merchantRule.assign.incomeType ?? input.incomeType,
      resolvedCategory: merchantRule.assign.category,
      resolutionTrace: trace,
      resolutionSource: 'merchant_rules',
      resolutionRuleId: merchantRule.id,
    }
  }

  withTraceStep(trace, 'merchant_rules', false, 'no_merchant_rule_match', null, null, null)

  if (!isUnknownCategory(input.providerCategory)) {
    withTraceStep(
      trace,
      'mcc',
      true,
      'provider_category_present',
      input.providerCategory,
      input.subcategory,
      null
    )

    return {
      category: input.providerCategory,
      subcategory: input.subcategory,
      incomeType: input.incomeType,
      resolvedCategory: input.providerCategory,
      resolutionTrace: trace,
      resolutionSource: 'mcc',
      resolutionRuleId: null,
    }
  }

  withTraceStep(trace, 'mcc', false, 'provider_category_missing_or_unknown', null, null, null)

  const counterpartyRule = selectBestRule(
    COUNTERPARTY_RULES.filter(rule =>
      matchesRule(rule, {
        normalizedLabel,
        normalizedAccount,
        normalizedMerchant,
        amount: input.amount,
      })
    )
  )

  if (counterpartyRule) {
    withTraceStep(
      trace,
      'counterparty',
      true,
      'matched_counterparty_rule',
      counterpartyRule.assign.category,
      counterpartyRule.assign.subcategory ?? input.subcategory,
      counterpartyRule.id
    )

    return {
      category: counterpartyRule.assign.category,
      subcategory: counterpartyRule.assign.subcategory ?? input.subcategory,
      incomeType: counterpartyRule.assign.incomeType ?? input.incomeType,
      resolvedCategory: counterpartyRule.assign.category,
      resolutionTrace: trace,
      resolutionSource: 'counterparty',
      resolutionRuleId: counterpartyRule.id,
    }
  }

  withTraceStep(trace, 'counterparty', false, 'no_counterparty_rule_match', null, null, null)

  withTraceStep(
    trace,
    'fallback',
    true,
    'kept_existing_category_or_unknown',
    input.category,
    input.subcategory,
    null
  )

  return {
    category: input.category,
    subcategory: input.subcategory,
    incomeType: input.incomeType,
    resolvedCategory: input.category,
    resolutionTrace: trace,
    resolutionSource: 'fallback',
    resolutionRuleId: null,
  }
}

export const transactionCategorizationPrecedence = PRECEDENCE
