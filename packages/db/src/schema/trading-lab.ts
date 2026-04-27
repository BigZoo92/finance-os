import { sql } from 'drizzle-orm'
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

// ---------------------------------------------------------------------------
// Trading Lab Strategy
// ---------------------------------------------------------------------------

export const tradingLabStrategy = pgTable(
  'trading_lab_strategy',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    strategyType: text('strategy_type')
      .notNull()
      .default('experimental')
      .$type<
        'technical' | 'signal-driven' | 'risk-model' | 'benchmark' | 'manual-hypothesis' | 'experimental'
      >(),
    status: text('status')
      .notNull()
      .default('draft')
      .$type<'draft' | 'active-paper' | 'archived'>(),
    enabled: boolean('enabled').notNull().default(true),
    tags: jsonb('tags').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    parameters: jsonb('parameters').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    indicators: jsonb('indicators')
      .$type<Array<{ name: string; params: Record<string, unknown> }>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    entryRules: jsonb('entry_rules')
      .$type<Array<{ id: string; description: string; condition: string }>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    exitRules: jsonb('exit_rules')
      .$type<Array<{ id: string; description: string; condition: string }>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    riskRules: jsonb('risk_rules')
      .$type<Array<{ id: string; description: string; condition: string }>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    assumptions: jsonb('assumptions').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    caveats: jsonb('caveats').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    scope: text('scope').notNull().default('admin').$type<'admin' | 'demo'>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  table => [
    uniqueIndex('trading_lab_strategy_slug_unique').on(table.slug),
    index('trading_lab_strategy_status_idx').on(table.status),
    index('trading_lab_strategy_type_idx').on(table.strategyType),
    index('trading_lab_strategy_enabled_idx').on(table.enabled),
  ]
)

// ---------------------------------------------------------------------------
// Trading Lab Backtest Run
// ---------------------------------------------------------------------------

export const tradingLabBacktestRun = pgTable(
  'trading_lab_backtest_run',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    strategyId: integer('strategy_id')
      .notNull()
      .references(() => tradingLabStrategy.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    marketDataSource: text('market_data_source').notNull().default('eodhd'),
    symbol: text('symbol').notNull(),
    timeframe: text('timeframe').notNull().default('1d'),
    startDate: timestamp('start_date', { withTimezone: true }).notNull(),
    endDate: timestamp('end_date', { withTimezone: true }).notNull(),
    initialCash: doublePrecision('initial_cash').notNull().default(10000),
    feesBps: doublePrecision('fees_bps').notNull().default(10),
    slippageBps: doublePrecision('slippage_bps').notNull().default(5),
    spreadBps: doublePrecision('spread_bps').notNull().default(2),
    runStatus: text('run_status')
      .notNull()
      .default('pending')
      .$type<'pending' | 'running' | 'completed' | 'failed'>(),
    runStartedAt: timestamp('run_started_at', { withTimezone: true }),
    runFinishedAt: timestamp('run_finished_at', { withTimezone: true }),
    durationMs: integer('duration_ms'),
    paramsHash: text('params_hash'),
    dataHash: text('data_hash'),
    resultSummary: jsonb('result_summary').$type<Record<string, unknown>>(),
    metrics: jsonb('metrics').$type<Record<string, unknown>>(),
    equityCurve: jsonb('equity_curve').$type<Array<{ date: string; equity: number }>>(),
    trades: jsonb('trades')
      .$type<
        Array<{
          entryDate: string
          exitDate: string
          side: 'long' | 'short'
          entryPrice: number
          exitPrice: number
          size: number
          pnl: number
          pnlPct: number
          fees: number
        }>
      >(),
    drawdowns: jsonb('drawdowns').$type<Array<{ date: string; drawdown: number }>>(),
    errorSummary: text('error_summary'),
    scope: text('scope').notNull().default('admin').$type<'admin' | 'demo'>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  table => [
    index('trading_lab_backtest_run_strategy_id_idx').on(table.strategyId),
    index('trading_lab_backtest_run_symbol_idx').on(table.symbol),
    index('trading_lab_backtest_run_status_idx').on(table.runStatus),
    index('trading_lab_backtest_run_created_at_idx').on(table.createdAt),
  ]
)

// ---------------------------------------------------------------------------
// Trading Lab Paper Scenario
// ---------------------------------------------------------------------------

export const tradingLabPaperScenario = pgTable(
  'trading_lab_paper_scenario',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    name: text('name').notNull(),
    description: text('description'),
    linkedSignalItemId: integer('linked_signal_item_id'),
    linkedNewsArticleId: integer('linked_news_article_id'),
    linkedStrategyId: integer('linked_strategy_id').references(() => tradingLabStrategy.id, {
      onDelete: 'set null',
    }),
    status: text('status')
      .notNull()
      .default('open')
      .$type<'open' | 'tracking' | 'invalidated' | 'confirmed' | 'archived'>(),
    thesis: text('thesis'),
    expectedOutcome: text('expected_outcome'),
    invalidationCriteria: text('invalidation_criteria'),
    riskNotes: text('risk_notes'),
    scope: text('scope').notNull().default('admin').$type<'admin' | 'demo'>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  table => [
    index('trading_lab_paper_scenario_status_idx').on(table.status),
    index('trading_lab_paper_scenario_strategy_idx').on(table.linkedStrategyId),
    index('trading_lab_paper_scenario_signal_idx').on(table.linkedSignalItemId),
    index('trading_lab_paper_scenario_news_idx').on(table.linkedNewsArticleId),
  ]
)

// ---------------------------------------------------------------------------
// Trading Lab Signal Link
// ---------------------------------------------------------------------------

export const tradingLabSignalLink = pgTable(
  'trading_lab_signal_link',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    signalItemId: integer('signal_item_id').notNull(),
    strategyId: integer('strategy_id')
      .notNull()
      .references(() => tradingLabStrategy.id, { onDelete: 'cascade' }),
    backtestRunId: integer('backtest_run_id').references(() => tradingLabBacktestRun.id, {
      onDelete: 'set null',
    }),
    relationType: text('relation_type')
      .notNull()
      .default('observation')
      .$type<'triggered-by' | 'supports' | 'contradicts' | 'observation'>(),
    confidence: doublePrecision('confidence').notNull().default(0.5),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  table => [
    index('trading_lab_signal_link_signal_idx').on(table.signalItemId),
    index('trading_lab_signal_link_strategy_idx').on(table.strategyId),
    index('trading_lab_signal_link_backtest_idx').on(table.backtestRunId),
  ]
)

// ---------------------------------------------------------------------------
// Attention Item
// ---------------------------------------------------------------------------

export const attentionItem = pgTable(
  'attention_item',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    sourceType: text('source_type')
      .notNull()
      .$type<
        'signal' | 'provider-health' | 'advisor' | 'budget' | 'portfolio' | 'trading-lab' | 'system'
      >(),
    sourceId: text('source_id'),
    severity: text('severity')
      .notNull()
      .default('info')
      .$type<'info' | 'watch' | 'important' | 'critical'>(),
    status: text('status')
      .notNull()
      .default('open')
      .$type<'open' | 'acknowledged' | 'dismissed' | 'resolved'>(),
    title: text('title').notNull(),
    summary: text('summary'),
    reason: text('reason'),
    actionHref: text('action_href'),
    dedupeKey: text('dedupe_key').notNull(),
    scope: text('scope').notNull().default('admin').$type<'admin' | 'demo'>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  table => [
    uniqueIndex('attention_item_dedupe_key_unique').on(table.dedupeKey),
    index('attention_item_source_type_idx').on(table.sourceType),
    index('attention_item_severity_idx').on(table.severity),
    index('attention_item_status_idx').on(table.status),
    index('attention_item_created_at_idx').on(table.createdAt),
    index('attention_item_expires_at_idx').on(table.expiresAt),
  ]
)
