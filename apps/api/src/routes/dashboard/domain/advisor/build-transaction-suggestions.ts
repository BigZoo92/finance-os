import type { DashboardTransactionsResponse } from '../../types'

const normalize = (value: string) => value.trim().toLowerCase()

const matchAny = (value: string, patterns: string[]) => patterns.some(pattern => value.includes(pattern))

export const buildDeterministicTransactionSuggestions = (
  transactions: DashboardTransactionsResponse['items']
) => {
  return transactions
    .filter(
      item =>
        item.resolutionSource === 'fallback' ||
        item.resolvedCategory === null ||
        normalize(item.label).length > 0
    )
    .slice(0, 24)
    .map(item => {
      const haystack = normalize(`${item.label} ${item.accountName ?? ''}`)
      let suggestedKind = item.direction === 'income' ? 'income' : 'expense'
      let suggestedCategory = item.resolvedCategory ?? (item.direction === 'income' ? 'income' : 'expenses')
      let suggestedSubcategory: string | null = item.subcategory
      const suggestedTags: string[] = []
      const rationale: string[] = []
      let confidence = item.resolutionSource === 'fallback' ? 0.42 : 0.58

      if (matchAny(haystack, ['salaire', 'salary', 'payroll', 'paye'])) {
        suggestedKind = 'income'
        suggestedCategory = 'salary'
        suggestedSubcategory = 'salary'
        confidence = 0.9
        rationale.push('Motif proche d un versement de salaire.')
      } else if (matchAny(haystack, ['dividend', 'coupon'])) {
        suggestedKind = 'income'
        suggestedCategory = 'investment_income'
        suggestedSubcategory = 'dividend'
        confidence = 0.82
        rationale.push('Motif proche d un revenu d investissement.')
      } else if (matchAny(haystack, ['vir', 'virement', 'transfer', 'instant'])) {
        suggestedKind = 'transfer'
        suggestedCategory = 'transfer'
        suggestedSubcategory = null
        confidence = Math.max(confidence, 0.65)
        rationale.push('Motif proche d un mouvement de compte a compte.')
      } else if (matchAny(haystack, ['bourse', 'broker', 'trade republic', 'pea', 'cto', 'etf'])) {
        suggestedKind = 'investment'
        suggestedCategory = 'investment'
        suggestedSubcategory = 'broker_transfer'
        confidence = 0.74
        suggestedTags.push('investment')
        rationale.push('Motif proche d une operation d investissement.')
      } else if (matchAny(haystack, ['impot', 'tax', 'dgfip'])) {
        suggestedKind = 'taxes'
        suggestedCategory = 'taxes'
        suggestedSubcategory = null
        confidence = 0.84
        rationale.push('Motif proche d un paiement fiscal.')
      } else if (matchAny(haystack, ['frais', 'fee', 'commission'])) {
        suggestedKind = 'fees'
        suggestedCategory = 'fees'
        suggestedSubcategory = null
        confidence = 0.76
        rationale.push('Motif proche de frais ou commissions.')
      } else if (matchAny(haystack, ['remboursement', 'refund', 'avoir'])) {
        suggestedKind = 'reimbursement'
        suggestedCategory = 'reimbursement'
        suggestedSubcategory = null
        confidence = 0.72
        rationale.push('Motif proche d un remboursement.')
      } else {
        rationale.push('Aucune regle forte: suggestion prudente a verifier.')
      }

      if (item.direction === 'income' && suggestedKind === 'expense') {
        suggestedKind = 'income'
        confidence = Math.min(confidence, 0.55)
        rationale.push('Signe du montant incoherent avec une depense.')
      }

      return {
        transactionId: item.id,
        suggestionKey: `tx-${item.id}`,
        status: 'suggested',
        suggestionSource: 'deterministic',
        suggestedKind,
        suggestedCategory,
        suggestedSubcategory,
        suggestedTags,
        confidence,
        rationale,
      }
    })
}
