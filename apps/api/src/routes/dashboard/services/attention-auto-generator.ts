/**
 * Attention auto-generation.
 *
 * Scans signal items, ingestion runs, and provider state to materialize
 * attention items deterministically. Idempotent via dedupeKey.
 */

import { and, desc, eq, sql } from 'drizzle-orm'
import { schema } from '@finance-os/db'
import type { ApiDb } from '../types'
import { createDashboardTradingLabRepository } from '../repositories/dashboard-trading-lab-repository'

const STALE_PROVIDER_HOURS = 24
const SIGNAL_ATTENTION_EXPIRY_DAYS = 5
const PROVIDER_ATTENTION_EXPIRY_DAYS = 2
const TRADING_ATTENTION_EXPIRY_DAYS = 7

const inDays = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000)

export interface AutoGenerateOptions {
  minRelevance?: number
  minConfidence?: number
}

export interface AutoGenerateResult {
  ok: boolean
  generated: number
  fromSignals: number
  fromProviders: number
  fromIngestionRuns: number
  fromBacktests: number
}

export const runAttentionAutoGenerator = async ({
  db,
  options,
}: {
  db: ApiDb
  options?: AutoGenerateOptions
}): Promise<AutoGenerateResult> => {
  const repo = createDashboardTradingLabRepository({ db })
  const minRelevance = options?.minRelevance ?? 60
  const minConfidence = options?.minConfidence ?? 50

  let fromSignals = 0
  let fromProviders = 0
  let fromIngestionRuns = 0
  let fromBacktests = 0

  // 1) signal items requiring attention
  try {
    const signalRows = await db
      .select()
      .from(schema.signalItem)
      .where(
        and(
          eq(schema.signalItem.requiresAttention, true),
          sql`${schema.signalItem.relevanceScore} >= ${minRelevance}`,
          sql`${schema.signalItem.confidenceScore} >= ${minConfidence}`,
        ),
      )
      .orderBy(desc(schema.signalItem.publishedAt))
      .limit(20)

    for (const row of signalRows) {
      const severity = row.urgencyScore >= 80 ? 'critical' : row.urgencyScore >= 60 ? 'important' : 'watch'
      await repo.upsertAttentionItem({
        sourceType: 'signal',
        sourceId: `signal:${row.id}`,
        severity,
        title: row.title.slice(0, 160),
        summary: (row.attentionReason ?? row.body ?? row.title).slice(0, 280),
        reason: `Signal flagged (${row.signalDomain}) by ${row.sourceProvider}`,
        actionHref: '/signaux',
        dedupeKey: `signal:item:${row.id}`,
        expiresAt: inDays(SIGNAL_ATTENTION_EXPIRY_DAYS),
      })
      fromSignals++
    }
  } catch {
    /* fail-soft */
  }

  // 2) provider state degraded / stale
  try {
    const cutoff = new Date(Date.now() - STALE_PROVIDER_HOURS * 60 * 60 * 1000)
    const providerRows = await db
      .select()
      .from(schema.newsProviderState)
      .where(
        sql`(${schema.newsProviderState.lastSuccessAt} IS NULL OR ${schema.newsProviderState.lastSuccessAt} < ${cutoff})
            AND ${schema.newsProviderState.enabled} = true`,
      )
      .limit(20)

    for (const row of providerRows) {
      await repo.upsertAttentionItem({
        sourceType: 'provider-health',
        sourceId: `provider:${row.provider}`,
        severity: row.lastErrorCode ? 'important' : 'watch',
        title: `Provider stale: ${row.provider}`,
        summary: row.lastErrorMessage ?? `No success in last ${STALE_PROVIDER_HOURS}h`,
        reason: row.lastErrorCode ?? 'stale_provider',
        actionHref: '/signaux/sources',
        dedupeKey: `provider:health:${row.provider}`,
        expiresAt: inDays(PROVIDER_ATTENTION_EXPIRY_DAYS),
      })
      fromProviders++
    }
  } catch {
    /* fail-soft */
  }

  // 3) failed signal ingestion runs
  try {
    const failedRuns = await db
      .select()
      .from(schema.signalIngestionRun)
      .where(eq(schema.signalIngestionRun.status, 'failed'))
      .orderBy(desc(schema.signalIngestionRun.startedAt))
      .limit(5)

    for (const row of failedRuns) {
      await repo.upsertAttentionItem({
        sourceType: 'system',
        sourceId: `ingestion-run:${row.id}`,
        severity: 'important',
        title: `Signal ingestion failed: ${row.provider}`,
        summary: row.errorSummary ?? 'Ingestion run failed',
        reason: 'failed_ingestion_run',
        actionHref: '/signaux/sources',
        dedupeKey: `ingestion-run:${row.id}`,
        expiresAt: inDays(PROVIDER_ATTENTION_EXPIRY_DAYS),
      })
      fromIngestionRuns++
    }
  } catch {
    /* fail-soft */
  }

  // 4) failed backtest runs
  try {
    const failedBacktests = await db
      .select()
      .from(schema.tradingLabBacktestRun)
      .where(eq(schema.tradingLabBacktestRun.runStatus, 'failed'))
      .orderBy(desc(schema.tradingLabBacktestRun.createdAt))
      .limit(5)

    for (const row of failedBacktests) {
      await repo.upsertAttentionItem({
        sourceType: 'trading-lab',
        sourceId: `backtest:${row.id}`,
        severity: 'important',
        title: `Backtest failed: ${row.symbol}`,
        summary: row.errorSummary ?? 'Backtest run failed',
        reason: 'failed_backtest',
        actionHref: '/ia/trading-lab',
        dedupeKey: `trading-lab:backtest:${row.id}`,
        expiresAt: inDays(TRADING_ATTENTION_EXPIRY_DAYS),
      })
      fromBacktests++
    }
  } catch {
    /* fail-soft */
  }

  const generated = fromSignals + fromProviders + fromIngestionRuns + fromBacktests
  return { ok: true, generated, fromSignals, fromProviders, fromIngestionRuns, fromBacktests }
}
