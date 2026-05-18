/**
 * Mirrors the shape returned by `GET /ops/env/diagnostics` in apps/api.
 * No secret values are ever shipped — only names, levels, and human reasons.
 */

export type ServiceName =
  | 'api'
  | 'worker'
  | 'web'
  | 'knowledge-service'
  | 'quant-service'
  | 'ops-alerts'

export type EnvIssueLevel = 'error' | 'warning' | 'info'

export type EnvIssueCode =
  | 'MISSING_REQUIRED_SECRET'
  | 'MISSING_OPTIONAL_SECRET'
  | 'FEATURE_ENABLED_WITHOUT_SECRET'
  | 'PLACEHOLDER_VALUE'
  | 'FORBIDDEN_KEY_LEAKED_TO_SERVICE'
  | 'COMPOSE_MISSING_KEY'
  | 'COMPOSE_FORBIDDEN_KEY'

export type EnvIssue = {
  level: EnvIssueLevel
  code: EnvIssueCode
  envName: string
  feature: string | null
  message: string
  remediation: string | null
}

export type FeatureReport = {
  feature: string
  flagKey: string
  enabled: boolean
  configured: boolean
  canRun: boolean
  missingRequiredSecrets: string[]
  missingOptionalSecrets: string[]
  placeholderSecrets: string[]
  reasonIfBlocked: string | null
}

export type ServiceDiagnosticsReport = {
  service: ServiceName
  features: FeatureReport[]
  issueCount: number
  errorCount: number
  warningCount: number
  issues: EnvIssue[]
}

export type EnvDiagnosticsResponse = {
  requestId: string
  mode: 'admin' | 'demo'
  services: ServiceDiagnosticsReport[]
  totals?: {
    errorCount: number
    warningCount: number
  }
  generatedAt: string
}
