import type { DashboardUseCases } from '../types'
import { applyTransactionAutoCategorization } from './transaction-auto-categorization'

interface CreateUpdateTransactionClassificationUseCaseDependencies {
  updateTransactionClassification: (
    transactionId: number,
    input: {
      category: string | null
      subcategory: string | null
      incomeType: 'salary' | 'recurring' | 'exceptional' | null
      tags: string[]
      merchant?: string | null
    }
  ) => Promise<{
    id: number
    bookingDate: string
    amount: string
    currency: string
    label: string
    merchant: string
    providerCategory: string | null
    customCategory: string | null
    customSubcategory: string | null
    category: string | null
    subcategory: string | null
    incomeType: 'salary' | 'recurring' | 'exceptional' | null
    tags: string[]
    powensConnectionId: string
    powensAccountId: string
    accountName: string | null
  } | null>
}

export const createUpdateTransactionClassificationUseCase = ({
  updateTransactionClassification,
}: CreateUpdateTransactionClassificationUseCaseDependencies): DashboardUseCases['updateTransactionClassification'] => {
  return async (transactionId, input) => {
    const uniqueTags = Array.from(
      new Set(
        input.tags
          .map(tag => tag.trim())
          .filter(tag => tag.length > 0)
          .slice(0, 10)
      )
    )

    const updated = await updateTransactionClassification(transactionId, {
      category: input.category,
      subcategory: input.subcategory,
      incomeType: input.incomeType,
      tags: uniqueTags,
      ...(input.merchant !== undefined ? { merchant: input.merchant } : {}),
    })

    if (!updated) {
      return null
    }

    const amount = Number(updated.amount)
    const normalizedAmount = Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0
    const normalizedClassification = applyTransactionAutoCategorization({
      label: updated.label,
      merchant: updated.merchant,
      amount: normalizedAmount,
      powensAccountId: updated.powensAccountId,
      accountName: updated.accountName,
      providerCategory: updated.providerCategory,
      customCategory: updated.customCategory,
      customSubcategory: updated.customSubcategory,
      category: updated.category,
      subcategory: updated.subcategory,
      incomeType: updated.incomeType,
    })

    return {
      id: updated.id,
      bookingDate: updated.bookingDate,
      amount: normalizedAmount,
      currency: updated.currency,
      direction: normalizedAmount >= 0 ? 'income' : 'expense',
      label: updated.label,
      merchant: updated.merchant,
      category: normalizedClassification.category,
      subcategory: normalizedClassification.subcategory,
      resolvedCategory: normalizedClassification.resolvedCategory,
      resolutionSource: normalizedClassification.resolutionSource,
      resolutionRuleId: normalizedClassification.resolutionRuleId,
      resolutionTrace: normalizedClassification.resolutionTrace,
      incomeType: normalizedClassification.incomeType,
      tags: updated.tags,
      powensConnectionId: updated.powensConnectionId,
      powensAccountId: updated.powensAccountId,
      accountName: updated.accountName,
    }
  }
}
