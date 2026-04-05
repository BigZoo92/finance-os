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
  {
    id: 'merchant-streaming',
    priority: 120,
    when: {
      amountSign: 'expense',
      merchantIncludes: ['spotify', 'netflix', 'apple.com/bill'],
    },
    assign: {
      category: 'Abonnements',
      subcategory: 'Streaming',
    },
  },
  {
    id: 'merchant-groceries',
    priority: 110,
    when: {
      amountSign: 'expense',
      merchantIncludes: ['carrefour', 'monoprix', 'auchan', 'lidl', 'leclerc'],
      minAmount: 5,
    },
    assign: {
      category: 'Courses',
      subcategory: 'Supermarche',
    },
  },
  {
    id: 'merchant-bank-fees-checking',
    priority: 130,
    when: {
      amountSign: 'expense',
      accountIncludes: ['courant', 'checking'],
      labelIncludes: ['frais', 'commission', 'cotisation'],
      maxAmount: 60,
    },
    assign: {
      category: 'Frais bancaires',
    },
  },
]

const COUNTERPARTY_RULES: CategorizationRule[] = [
  {
    id: 'counterparty-salary',
    priority: 100,
    when: {
      amountSign: 'income',
      labelIncludes: ['salaire', 'payroll', 'paie'],
    },
    assign: {
      category: 'Revenus',
      subcategory: 'Salaire',
      incomeType: 'salary',
    },
  },
  {
    id: 'counterparty-transport',
    priority: 90,
    when: {
      amountSign: 'expense',
      labelIncludes: ['sncf', 'ratp', 'uber', 'bolt'],
    },
    assign: {
      category: 'Transport',
    },
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
  input: { normalizedLabel: string; normalizedAccount: string; normalizedMerchant: string; amount: number }
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

  if (rule.when.labelIncludes && !rule.when.labelIncludes.some(part => input.normalizedLabel.includes(normalizeText(part)))) {
    return false
  }

  if (
    rule.when.merchantIncludes &&
    !rule.when.merchantIncludes.some(part => input.normalizedMerchant.includes(normalizeText(part)))
  ) {
    return false
  }

  if (rule.when.accountIncludes && !rule.when.accountIncludes.some(part => input.normalizedAccount.includes(normalizeText(part)))) {
    return false
  }

  return true
}

const selectBestRule = (matches: CategorizationRule[]) => {
  return [...matches].sort((left, right) => {
    if (left.priority !== right.priority) {
      return right.priority - left.priority
    }
    return left.id.localeCompare(right.id)
  })[0] ?? null
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
    withTraceStep(trace, 'manual_override', true, 'custom_category_present', input.customCategory, input.customSubcategory, null)

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
