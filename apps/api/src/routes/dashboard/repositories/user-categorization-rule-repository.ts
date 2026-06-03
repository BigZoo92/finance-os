import { schema } from '@finance-os/db'
import { desc, eq, sql } from 'drizzle-orm'
import type { UserCategorizationRule } from '../domain/transaction-auto-categorization'
import type { ApiDb } from '../types'

export type UserCategorizationRuleWriteInput = {
  name: string
  enabled: boolean
  priority: number
  matcherType: UserCategorizationRule['matcherType']
  matcherValue: string
  amountSign: UserCategorizationRule['amountSign']
  minAmount: number | null
  maxAmount: number | null
  category: string
  subcategory: string | null
  incomeType: UserCategorizationRule['incomeType']
  validFrom: string | null
  validTo: string | null
  notes: string | null
  metadata: Record<string, unknown>
}

export type CategorizationDryRunTransaction = {
  bookingDate?: string
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

const toNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

const mapRule = (row: {
  id: number
  name: string
  enabled: boolean
  priority: number
  matcherType: UserCategorizationRule['matcherType']
  matcherValue: string
  amountSign: UserCategorizationRule['amountSign']
  minAmount: string | null
  maxAmount: string | null
  category: string
  subcategory: string | null
  incomeType: UserCategorizationRule['incomeType']
  validFrom: string | null
  validTo: string | null
  notes: string | null
  metadata: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}) => ({
  id: String(row.id),
  name: row.name,
  enabled: row.enabled,
  priority: row.priority,
  matcherType: row.matcherType,
  matcherValue: row.matcherValue,
  amountSign: row.amountSign ?? null,
  minAmount: row.minAmount === null ? null : toNumber(row.minAmount),
  maxAmount: row.maxAmount === null ? null : toNumber(row.maxAmount),
  category: row.category,
  subcategory: row.subcategory,
  incomeType: row.incomeType ?? null,
  validFrom: row.validFrom,
  validTo: row.validTo,
  notes: row.notes,
  metadata: row.metadata,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

export const createUserCategorizationRuleRepository = ({ db }: { db: ApiDb }) => ({
  async listRules() {
    const rows = await db
      .select()
      .from(schema.userCategorizationRule)
      .orderBy(desc(schema.userCategorizationRule.priority), desc(schema.userCategorizationRule.id))
      .limit(500)
    return rows.map(mapRule)
  },

  async listEnabledRules(): Promise<UserCategorizationRule[]> {
    const rows = await db
      .select()
      .from(schema.userCategorizationRule)
      .where(eq(schema.userCategorizationRule.enabled, true))
      .orderBy(desc(schema.userCategorizationRule.priority), desc(schema.userCategorizationRule.id))
      .limit(500)
    return rows.map(mapRule)
  },

  async createRule(input: UserCategorizationRuleWriteInput) {
    const [row] = await db
      .insert(schema.userCategorizationRule)
      .values({
        name: input.name,
        enabled: input.enabled,
        priority: input.priority,
        matcherType: input.matcherType,
        matcherValue: input.matcherValue,
        amountSign: input.amountSign ?? null,
        minAmount: input.minAmount === null ? null : String(input.minAmount),
        maxAmount: input.maxAmount === null ? null : String(input.maxAmount),
        category: input.category,
        subcategory: input.subcategory,
        incomeType: input.incomeType ?? null,
        validFrom: input.validFrom,
        validTo: input.validTo,
        notes: input.notes,
        metadata: input.metadata,
      })
      .returning()

    return row ? mapRule(row) : null
  },

  async getTransactionForDryRun(transactionId: number): Promise<CategorizationDryRunTransaction | null> {
    const [row] = await db
      .select({
        bookingDate: schema.transaction.bookingDate,
        label: schema.transaction.label,
        amount: schema.transaction.amount,
        powensAccountId: schema.transaction.powensAccountId,
        accountName: schema.financialAccount.name,
        merchant: sql<string>`coalesce(nullif(${schema.transaction.customMerchant}, ''), nullif(${schema.transaction.merchant}, ''), ${schema.transaction.label})`,
        providerCategory: schema.transaction.category,
        customCategory: schema.transaction.customCategory,
        customSubcategory: schema.transaction.customSubcategory,
        category: sql<
          string | null
        >`coalesce(nullif(${schema.transaction.customCategory}, ''), nullif(${schema.transaction.category}, ''))`,
        subcategory: schema.transaction.customSubcategory,
        incomeType: sql<'salary' | 'recurring' | 'exceptional' | null>`case
          when ${schema.transaction.amount} <= 0 then null
          else coalesce(nullif(${schema.transaction.customIncomeType}, ''), 'exceptional')
        end`,
      })
      .from(schema.transaction)
      .leftJoin(
        schema.financialAccount,
        eq(schema.transaction.powensAccountId, schema.financialAccount.powensAccountId)
      )
      .where(eq(schema.transaction.id, transactionId))
      .limit(1)

    if (!row) return null
    return {
      bookingDate: row.bookingDate,
      label: row.label,
      amount: toNumber(row.amount),
      powensAccountId: row.powensAccountId,
      accountName: row.accountName,
      merchant: row.merchant,
      providerCategory: row.providerCategory,
      customCategory: row.customCategory,
      customSubcategory: row.customSubcategory,
      category: row.category,
      subcategory: row.subcategory,
      incomeType: row.incomeType,
    }
  },
})
