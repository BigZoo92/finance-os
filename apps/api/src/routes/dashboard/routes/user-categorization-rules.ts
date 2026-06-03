import { Elysia, type Static } from 'elysia'
import { getRequestMeta } from '../../../auth/context'
import { demoOrReal } from '../../../auth/demo-mode'
import { requireAdmin } from '../../../auth/guard'
import {
  applyTransactionAutoCategorization,
  type UserCategorizationRule,
} from '../domain/transaction-auto-categorization'
import {
  createUserCategorizationRuleRepository,
  type CategorizationDryRunTransaction,
} from '../repositories/user-categorization-rule-repository'
import {
  dashboardUserCategorizationDryRunBodySchema,
  dashboardUserCategorizationRuleBodySchema,
} from '../schemas'
import type { ApiDb } from '../types'

const DEMO_RULES: UserCategorizationRule[] = [
  {
    id: 'demo-ai-subscriptions',
    name: 'AI subscriptions',
    enabled: true,
    priority: 200,
    matcherType: 'merchant_contains',
    matcherValue: 'openai',
    amountSign: 'expense',
    category: 'Abonnements',
    subcategory: 'Logiciels IA',
  },
]

const DEMO_TRANSACTION: CategorizationDryRunTransaction = {
  bookingDate: '2026-06-03',
  label: 'OPENAI API',
  amount: -20,
  powensAccountId: 'demo-account',
  accountName: 'Compte demo',
  merchant: 'OpenAI',
  providerCategory: 'Unknown',
  customCategory: null,
  customSubcategory: null,
  category: null,
  subcategory: null,
  incomeType: null,
}

type UserCategorizationRuleBody = Static<typeof dashboardUserCategorizationRuleBodySchema>
type UserCategorizationDryRunBody = Static<typeof dashboardUserCategorizationDryRunBodySchema>
type UserCategorizationDryRunTransactionBody = NonNullable<UserCategorizationDryRunBody['transaction']>

const normalizeRuleInput = (
  input: UserCategorizationRuleBody,
  id = 'candidate-rule'
): UserCategorizationRule => ({
  id,
  name: input.name,
  enabled: input.enabled ?? true,
  priority: input.priority ?? 100,
  matcherType: input.matcherType,
  matcherValue: input.matcherValue,
  amountSign: input.amountSign ?? null,
  minAmount: input.minAmount ?? null,
  maxAmount: input.maxAmount ?? null,
  category: input.category,
  subcategory: input.subcategory ?? null,
  incomeType: input.incomeType ?? null,
  validFrom: input.validFrom ?? null,
  validTo: input.validTo ?? null,
})

const normalizeRuleWriteInput = (input: UserCategorizationRuleBody) => ({
  name: input.name.trim(),
  enabled: input.enabled ?? true,
  priority: input.priority ?? 100,
  matcherType: input.matcherType,
  matcherValue: input.matcherValue.trim(),
  amountSign: input.amountSign ?? null,
  minAmount: input.minAmount ?? null,
  maxAmount: input.maxAmount ?? null,
  category: input.category.trim(),
  subcategory: input.subcategory?.trim() || null,
  incomeType: input.incomeType ?? null,
  validFrom: input.validFrom ?? null,
  validTo: input.validTo ?? null,
  notes: input.notes?.trim() || null,
  metadata: input.metadata ?? {},
})

const normalizeDryRunTransaction = (
  input: UserCategorizationDryRunTransactionBody | undefined
): CategorizationDryRunTransaction | null => {
  if (!input) return null
  return {
    ...(input.bookingDate ? { bookingDate: input.bookingDate } : {}),
    label: input.label,
    amount: input.amount,
    powensAccountId: input.powensAccountId,
    accountName: input.accountName ?? null,
    merchant: input.merchant ?? input.label,
    providerCategory: input.providerCategory ?? null,
    customCategory: input.customCategory ?? null,
    customSubcategory: input.customSubcategory ?? null,
    category: input.category ?? null,
    subcategory: input.subcategory ?? null,
    incomeType: input.incomeType ?? null,
  }
}

const runCategorization = (
  transaction: CategorizationDryRunTransaction,
  rules: UserCategorizationRule[]
) =>
  applyTransactionAutoCategorization({
    ...(transaction.bookingDate ? { bookingDate: transaction.bookingDate } : {}),
    label: transaction.label,
    amount: transaction.amount,
    powensAccountId: transaction.powensAccountId,
    accountName: transaction.accountName,
    merchant: transaction.merchant,
    providerCategory: transaction.providerCategory,
    customCategory: transaction.customCategory,
    customSubcategory: transaction.customSubcategory,
    category: transaction.category,
    subcategory: transaction.subcategory,
    incomeType: transaction.incomeType,
    userRules: rules,
  })

export const createUserCategorizationRulesRoute = ({ db }: { db: ApiDb }) => {
  const repository = createUserCategorizationRuleRepository({ db })

  return new Elysia()
    .get('/transactions/categorization-rules', async context => {
      const requestId = getRequestMeta(context).requestId
      return demoOrReal({
        context,
        demo: () => ({
          ok: true as const,
          mode: 'demo' as const,
          source: 'demo_fixture' as const,
          requestId,
          items: DEMO_RULES,
        }),
        real: async () => {
          requireAdmin(context)
          const items = await repository.listRules()
          return {
            ok: true as const,
            mode: 'admin' as const,
            source: 'db' as const,
            requestId,
            items,
          }
        },
      })
    })
    .post(
      '/transactions/categorization-rules',
      async context => {
        const requestId = getRequestMeta(context).requestId
        return demoOrReal({
          context,
          demo: () => {
            context.set.status = 403
            return {
              ok: false as const,
              code: 'DEMO_MODE_FORBIDDEN' as const,
              message: 'Admin session required',
              requestId,
            }
          },
          real: async () => {
            requireAdmin(context)
            const item = await repository.createRule(normalizeRuleWriteInput(context.body))
            return {
              ok: true as const,
              mode: 'admin' as const,
              source: 'db' as const,
              requestId,
              item,
            }
          },
        })
      },
      { body: dashboardUserCategorizationRuleBodySchema }
    )
    .post(
      '/transactions/categorization-rules/dry-run',
      async context => {
        const requestId = getRequestMeta(context).requestId
        return demoOrReal({
          context,
          demo: () => {
            const candidateRule = context.body.rule
              ? normalizeRuleInput(context.body.rule)
              : DEMO_RULES[0] ?? {
                  id: 'demo-default-rule',
                  enabled: true,
                  priority: 100,
                  matcherType: 'label_contains' as const,
                  matcherValue: 'openai',
                  category: 'Abonnements',
                }
            const transaction = normalizeDryRunTransaction(context.body.transaction) ?? DEMO_TRANSACTION
            return {
              ok: true as const,
              mode: 'demo' as const,
              source: 'demo_fixture' as const,
              requestId,
              transaction,
              result: runCategorization(transaction, [candidateRule]),
            }
          },
          real: async () => {
            requireAdmin(context)
            const providedTransaction = normalizeDryRunTransaction(context.body.transaction)
            const transaction =
              providedTransaction ??
              (context.body.transactionId
                ? await repository.getTransactionForDryRun(context.body.transactionId)
                : null)

            if (!transaction) {
              context.set.status = context.body.transactionId ? 404 : 400
              return {
                ok: false as const,
                code: context.body.transactionId ? ('NOT_FOUND' as const) : ('BAD_REQUEST' as const),
                message: context.body.transactionId
                  ? 'Transaction not found'
                  : 'transaction or transactionId is required',
                requestId,
              }
            }

            const persistedRules = await repository.listEnabledRules()
            const candidateRules = context.body.rule
              ? [normalizeRuleInput(context.body.rule), ...persistedRules]
              : persistedRules

            return {
              ok: true as const,
              mode: 'admin' as const,
              source: 'db' as const,
              requestId,
              transaction,
              result: runCategorization(transaction, candidateRules),
            }
          },
        })
      },
      { body: dashboardUserCategorizationDryRunBodySchema }
    )
}
