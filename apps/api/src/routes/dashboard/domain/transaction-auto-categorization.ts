interface TransactionAutoCategorizationInput {
  label: string
  amount: number
  powensAccountId: string
  accountName: string | null
  category: string | null
  subcategory: string | null
  incomeType: 'salary' | 'recurring' | 'exceptional' | null
}

interface TransactionAutoCategorizationResult {
  category: string | null
  subcategory: string | null
  incomeType: 'salary' | 'recurring' | 'exceptional' | null
  autoCategorizationRuleId: string | null
}

interface CategorizationRule {
  id: string
  priority: number
  when: {
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

const AUTO_CATEGORIZATION_RULES: CategorizationRule[] = [
  {
    id: 'income-salary-keywords',
    priority: 120,
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
    id: 'subscriptions-streaming',
    priority: 110,
    when: {
      amountSign: 'expense',
      labelIncludes: ['netflix', 'spotify', 'apple.com/bill'],
    },
    assign: {
      category: 'Abonnements',
      subcategory: 'Streaming',
    },
  },
  {
    id: 'groceries-supermarket',
    priority: 100,
    when: {
      amountSign: 'expense',
      labelIncludes: ['carrefour', 'monoprix', 'auchan', 'lidl', 'leclerc'],
      minAmount: 5,
    },
    assign: {
      category: 'Courses',
      subcategory: 'Supermarche',
    },
  },
  {
    id: 'transport-commute',
    priority: 90,
    when: {
      amountSign: 'expense',
      labelIncludes: ['sncf', 'ratp', 'uber', 'bolt'],
    },
    assign: {
      category: 'Transport',
    },
  },
  {
    id: 'bank-fees-checking-account',
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

const normalizeText = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

const amountDirection = (amount: number) => (amount >= 0 ? 'income' : 'expense')

const matchesRule = (rule: CategorizationRule, input: { normalizedLabel: string; normalizedAccount: string; amount: number }) => {
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

  if (rule.when.accountIncludes && !rule.when.accountIncludes.some(part => input.normalizedAccount.includes(normalizeText(part)))) {
    return false
  }

  return true
}

const ruleSpecificity = (rule: CategorizationRule) => {
  let score = 0
  if (rule.when.labelIncludes) {
    score += 2
  }
  if (rule.when.accountIncludes) {
    score += 2
  }
  if (rule.when.amountSign) {
    score += 1
  }
  if (typeof rule.when.minAmount === 'number' || typeof rule.when.maxAmount === 'number') {
    score += 1
  }
  return score
}

const selectBestRule = (matches: CategorizationRule[]) => {
  const sorted = [...matches].sort((left, right) => {
    if (left.priority !== right.priority) {
      return right.priority - left.priority
    }

    const specificityDelta = ruleSpecificity(right) - ruleSpecificity(left)
    if (specificityDelta !== 0) {
      return specificityDelta
    }

    return left.id.localeCompare(right.id)
  })

  return sorted[0] ?? null
}

const shouldApplyRule = (input: TransactionAutoCategorizationInput) => {
  if (input.category && input.category !== 'Unknown') {
    return false
  }

  return true
}

export const applyTransactionAutoCategorization = (
  input: TransactionAutoCategorizationInput
): TransactionAutoCategorizationResult => {
  if (!shouldApplyRule(input)) {
    return {
      category: input.category,
      subcategory: input.subcategory,
      incomeType: input.incomeType,
      autoCategorizationRuleId: null,
    }
  }

  const normalizedLabel = normalizeText(input.label)
  const normalizedAccount = normalizeText(input.accountName ?? input.powensAccountId)
  const matches = AUTO_CATEGORIZATION_RULES.filter(rule =>
    matchesRule(rule, {
      normalizedLabel,
      normalizedAccount,
      amount: input.amount,
    })
  )

  const bestRule = selectBestRule(matches)

  if (!bestRule) {
    return {
      category: input.category,
      subcategory: input.subcategory,
      incomeType: input.incomeType,
      autoCategorizationRuleId: null,
    }
  }

  return {
    category: bestRule.assign.category,
    subcategory: bestRule.assign.subcategory ?? input.subcategory,
    incomeType: bestRule.assign.incomeType ?? input.incomeType,
    autoCategorizationRuleId: bestRule.id,
  }
}

export const transactionAutoCategorizationRules = AUTO_CATEGORIZATION_RULES
