#!/usr/bin/env bun
/**
 * Compose ↔ env-schema parity guard.
 *
 * Purpose: prevent regressions where a feature flag or provider credential
 * exists in `packages/env/src/index.ts` (and is consumed by API/worker routes)
 * but is NOT propagated to the corresponding container via
 * `docker-compose.prod.yml`. That drift is silent — the container falls back
 * to zod defaults instead of the Dokploy value, and features stay disabled.
 *
 * Strategy: for each service (api, worker, web, ops-alerts) we maintain a
 * curated list of keys that MUST be present in the service `environment:`
 * block. The script parses the compose YAML manually (no yaml dep required)
 * and fails with a precise diff if any required key is missing.
 *
 * Run:
 *   bun scripts/check-compose-env-parity.ts
 *
 * The corresponding bun test (`scripts/check-compose-env-parity.test.ts`)
 * runs this guard in CI to keep the property always true.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const COMPOSE_PATH = resolve(import.meta.dir, '..', 'docker-compose.prod.yml')

type ServiceName = 'api' | 'worker' | 'web' | 'ops-alerts'

/**
 * Keys that the API runtime reads via `getApiEnv()` AND that are configured
 * via Dokploy (i.e. not hard-coded). Adding a new flag here means the compose
 * MUST also declare it under `api.environment:`.
 */
export const API_REQUIRED_KEYS: readonly string[] = [
  'EXTERNAL_INTEGRATIONS_SAFE_MODE',
  'EXTERNAL_INVESTMENTS_ENABLED',
  'EXTERNAL_INVESTMENTS_SAFE_MODE',
  // Transactions categorization
  'TRANSACTIONS_CATEGORIZATION_MIGRATION_ENABLED',
  'TRANSACTIONS_CATEGORIZATION_ROLLOUT_PERCENT',
  'TRANSACTIONS_CATEGORIZATION_SHADOW_LATENCY_BUDGET_MS',
  'AI_RELABEL_ENABLED',
  'ENRICHMENT_BULK_TRIAGE_ENABLED',
  // Market data
  'MARKET_DATA_ENABLED',
  'MARKET_DATA_REFRESH_ENABLED',
  'MARKET_DATA_EODHD_ENABLED',
  'MARKET_DATA_TWELVEDATA_ENABLED',
  'MARKET_DATA_FRED_ENABLED',
  'MARKET_DATA_FORCE_FIXTURE_FALLBACK',
  'MARKET_DATA_STALE_AFTER_MINUTES',
  'MARKET_DATA_REFRESH_COOLDOWN_SECONDS',
  'EODHD_API_KEY',
  'TWELVEDATA_API_KEY',
  'FRED_API_KEY',
  // X / social
  'NEWS_PROVIDER_X_TWITTER_ENABLED',
  'NEWS_PROVIDER_X_TWITTER_QUERY',
  'NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN',
  'SIGNALS_SOCIAL_POLLING_ENABLED',
  'SIGNALS_MANUAL_IMPORT_ENABLED',
  'ADVISOR_X_SIGNALS_MODE',
  // AI
  'AI_ADVISOR_ENABLED',
  'AI_ADVISOR_FORCE_LOCAL_ONLY',
  'AI_POST_MORTEM_ENABLED',
  'AI_CHAT_ENABLED',
  'AI_CHALLENGER_ENABLED',
  'AI_OPENAI_API_KEY',
  'AI_OPENAI_CLASSIFIER_MODEL',
  'AI_OPENAI_DAILY_MODEL',
  'AI_OPENAI_DEEP_MODEL',
  'AI_ANTHROPIC_API_KEY',
  'AI_ANTHROPIC_CHALLENGER_MODEL',
  'AI_BUDGET_DAILY_USD',
  'AI_BUDGET_MONTHLY_USD',
  // Knowledge service
  'KNOWLEDGE_SERVICE_ENABLED',
  'KNOWLEDGE_SERVICE_URL',
  'KNOWLEDGE_SERVICE_TIMEOUT_MS',
  'AI_KNOWLEDGE_QA_RETRIEVAL_ENABLED',
  'ADVISOR_GRAPH_INGEST_ENABLED',
  // External investments providers
  'IBKR_FLEX_ENABLED',
  'IBKR_FLEX_BASE_URL',
  'IBKR_FLEX_TIMEOUT_MS',
  'BINANCE_SPOT_ENABLED',
  'BINANCE_SPOT_BASE_URL',
  'BINANCE_SPOT_TIMEOUT_MS',
  // Failsoft
  'FAILSOFT_POLICY_ENABLED',
  'FAILSOFT_SOURCE_ORDER',
  'FAILSOFT_NEWS_ENABLED',
  'FAILSOFT_INSIGHTS_ENABLED',
  // Attention
  'ATTENTION_SYSTEM_ENABLED',
]

/**
 * Keys that the worker scheduler stack reads via `getWorkerEnv()`. The
 * worker triggers API routes for actual work — it doesn't need provider
 * keys (EODHD, TwelveData, FRED, OpenAI…) directly.
 */
export const WORKER_REQUIRED_KEYS: readonly string[] = [
  'EXTERNAL_INTEGRATIONS_SAFE_MODE',
  'WORKER_AUTO_SYNC_ENABLED',
  'AI_POST_MORTEM_AUTO_RUN_ENABLED',
  'AI_POST_MORTEM_CRON',
  'AI_POST_MORTEM_TIMEZONE',
  'AI_DAILY_AUTO_RUN_ENABLED',
  'AI_DAILY_INTERVAL_MS',
  'DAILY_INTELLIGENCE_ENABLED',
  'DAILY_INTELLIGENCE_CRON',
  'DAILY_INTELLIGENCE_TIMEZONE',
  'NEWS_AUTO_INGEST_ENABLED',
  'NEWS_FETCH_INTERVAL_MS',
  'MARKET_DATA_AUTO_REFRESH_ENABLED',
  'MARKET_DATA_REFRESH_INTERVAL_MS',
  'SIGNALS_SOCIAL_POLLING_ENABLED',
  'SIGNALS_SOCIAL_POLLING_INTERVAL_MS',
  'ATTENTION_SYSTEM_ENABLED',
  'ATTENTION_REBUILD_AUTO_ENABLED',
  'ATTENTION_REBUILD_INTERVAL_MS',
  'AI_ADVISOR_ENABLED',
  'AI_ADVISOR_FORCE_LOCAL_ONLY',
  'AI_KNOWLEDGE_QA_RETRIEVAL_ENABLED',
  'ADVISOR_X_SIGNALS_MODE',
]

/**
 * VITE_* flags the web container needs. Secrets MUST never appear here.
 */
export const WEB_REQUIRED_KEYS: readonly string[] = [
  'VITE_API_BASE_URL',
  'VITE_APP_ORIGIN',
  'VITE_APP_TITLE',
  'VITE_AI_ADVISOR_ENABLED',
  'VITE_AI_ADVISOR_ADMIN_ONLY',
  'VITE_DASHBOARD_HEALTH_SIGNALS_ENABLED',
  'VITE_PWA_NOTIFICATIONS_ENABLED',
  'VITE_PWA_CRITICAL_ENABLED',
]

/**
 * Ops-alerts monitor. Only ALERTS_* and minimal infra are needed; no provider
 * secrets, no AI keys.
 */
export const OPS_ALERTS_REQUIRED_KEYS: readonly string[] = [
  'ALERTS_ENABLED',
  'ALERTS_POLL_INTERVAL_MS',
  'ALERTS_HEALTHCHECK_URLS',
  'ALERTS_WORKER_HEARTBEAT_FILE',
  'ALERTS_WORKER_STALE_AFTER_MS',
  'ALERTS_DISK_FREE_PERCENT_THRESHOLD',
  'ALERTS_DISK_PATHS',
]

/**
 * Keys that MUST NOT appear in a given service env (defense against secret
 * leakage to the wrong container). Empty for now but kept as a hook.
 */
export const FORBIDDEN_KEYS_BY_SERVICE: Record<ServiceName, readonly string[]> = {
  api: [],
  worker: [],
  // The web container is publicly reachable; it must never see backend secrets.
  web: [
    'AI_OPENAI_API_KEY',
    'AI_ANTHROPIC_API_KEY',
    'NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN',
    'EODHD_API_KEY',
    'TWELVEDATA_API_KEY',
    'FRED_API_KEY',
    'ALPHA_VANTAGE_API_KEY',
    'POWENS_CLIENT_SECRET',
    'AUTH_SESSION_SECRET',
    'APP_ENCRYPTION_KEY',
    'AUTH_ADMIN_PASSWORD_HASH',
    'AUTH_ADMIN_PASSWORD_HASH_B64',
    'NEO4J_PASSWORD',
    'KNOWLEDGE_NEO4J_PASSWORD',
    'QDRANT_API_KEY',
    'KNOWLEDGE_QDRANT_API_KEY',
    'POSTGRES_PASSWORD',
    'BLUESKY_APP_PASSWORD',
    'PUSH_VAPID_PRIVATE_KEY',
  ],
  'ops-alerts': [
    'AI_OPENAI_API_KEY',
    'AI_ANTHROPIC_API_KEY',
    'NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN',
    'EODHD_API_KEY',
    'TWELVEDATA_API_KEY',
    'FRED_API_KEY',
    'POWENS_CLIENT_SECRET',
    'AUTH_SESSION_SECRET',
    'APP_ENCRYPTION_KEY',
  ],
}

const REQUIRED_BY_SERVICE: Record<ServiceName, readonly string[]> = {
  api: API_REQUIRED_KEYS,
  worker: WORKER_REQUIRED_KEYS,
  web: WEB_REQUIRED_KEYS,
  'ops-alerts': OPS_ALERTS_REQUIRED_KEYS,
}

/**
 * Lightweight YAML reader: extracts the `environment:` block keys for a
 * specific top-level service in docker-compose.prod.yml. Avoids pulling a
 * full yaml parser dep — we only care about top-level keys named like
 * `^      ([A-Z_][A-Z0-9_]*):` directly under `services.<name>.environment`.
 */
export const extractServiceEnvKeys = (composeYaml: string, service: ServiceName): Set<string> => {
  const lines = composeYaml.split('\n')
  const keys = new Set<string>()

  let insideService = false
  let insideEnv = false
  let envBaseIndent = -1

  for (const line of lines) {
    // Top-level service header: 2 spaces + `<name>:`
    const serviceHeaderMatch = line.match(/^ {2}([a-zA-Z0-9_-]+):\s*$/)
    if (serviceHeaderMatch) {
      insideService = serviceHeaderMatch[1] === service
      insideEnv = false
      envBaseIndent = -1
      continue
    }

    if (!insideService) continue

    if (!insideEnv) {
      const envHeader = line.match(/^( {4,})environment:\s*$/)
      if (envHeader) {
        insideEnv = true
        envBaseIndent = envHeader[1].length
      }
      continue
    }

    // Stop conditions: empty line outside or a new sibling key at same indent
    // as `environment:`.
    if (line.trim() === '') {
      continue
    }
    const leadingSpaces = line.match(/^( *)/)?.[1].length ?? 0
    if (leadingSpaces <= envBaseIndent && line.trim().length > 0) {
      // left the environment block
      insideEnv = false
      envBaseIndent = -1
      continue
    }

    const keyMatch = line.match(/^ {6,}([A-Z_][A-Z0-9_]*):/)
    if (keyMatch) {
      keys.add(keyMatch[1])
    }
  }

  return keys
}

export type ParityIssue =
  | { service: ServiceName; kind: 'missing'; key: string }
  | { service: ServiceName; kind: 'forbidden'; key: string }

export const checkComposeEnvParity = (composeYaml: string): ParityIssue[] => {
  const issues: ParityIssue[] = []

  const services: ServiceName[] = ['api', 'worker', 'web', 'ops-alerts']
  for (const service of services) {
    const declared = extractServiceEnvKeys(composeYaml, service)
    const required = REQUIRED_BY_SERVICE[service]
    const forbidden = FORBIDDEN_KEYS_BY_SERVICE[service] ?? []

    for (const key of required) {
      if (!declared.has(key)) {
        issues.push({ service, kind: 'missing', key })
      }
    }
    for (const key of forbidden) {
      if (declared.has(key)) {
        issues.push({ service, kind: 'forbidden', key })
      }
    }
  }

  return issues
}

const formatIssue = (issue: ParityIssue): string => {
  if (issue.kind === 'missing') {
    return `  [${issue.service}] MISSING ${issue.key} — declared as required by code but absent from docker-compose.prod.yml ${issue.service}.environment`
  }
  return `  [${issue.service}] FORBIDDEN ${issue.key} — must not be propagated to this container (secret/scope leak)`
}

const main = () => {
  const yaml = readFileSync(COMPOSE_PATH, 'utf8')
  const issues = checkComposeEnvParity(yaml)
  if (issues.length === 0) {
    console.log('✓ docker-compose.prod.yml env parity OK')
    return
  }

  console.error('✗ docker-compose.prod.yml env parity FAILED')
  for (const issue of issues) {
    console.error(formatIssue(issue))
  }
  process.exit(1)
}

if (import.meta.main) {
  main()
}
