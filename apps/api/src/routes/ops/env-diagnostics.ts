import {
  diagnoseServiceEnv,
  type ServiceDiagnostics,
  type ServiceName,
} from '@finance-os/env/diagnostics'
import { Elysia } from 'elysia'
import { getAuth, getRequestMeta } from '../../auth/context'
import { requireAdmin } from '../../auth/guard'

/**
 * Admin-only env diagnostics endpoint. Returns a per-service report of
 * which features are enabled, configured, and `canRun` — without leaking
 * any secret value.
 *
 * Demo mode receives a redacted shape (services + feature names only).
 *
 * NOTE on multi-service truth: this endpoint runs inside the API container,
 * so it can only see API + worker shared env. For knowledge-service /
 * quant-service we report the API-side coupling only (`KNOWLEDGE_SERVICE_URL`
 * present? `QUANT_SERVICE_URL` present?). Internal env of those containers
 * stays on their side.
 */
const summarize = (report: ServiceDiagnostics) => ({
  service: report.service,
  features: report.features,
  issueCount: report.issues.length,
  errorCount: report.issues.filter(i => i.level === 'error').length,
  warningCount: report.issues.filter(i => i.level === 'warning').length,
  issues: report.issues.map(issue => ({
    level: issue.level,
    code: issue.code,
    envName: issue.envName,
    feature: issue.feature ?? null,
    message: issue.message,
    remediation: issue.remediation ?? null,
  })),
})

const SERVICES_TO_REPORT: ServiceName[] = [
  'api',
  'worker',
  'web',
  'knowledge-service',
  'quant-service',
  'ops-alerts',
]

export const createOpsEnvDiagnosticsRoute = () =>
  new Elysia({ prefix: '/ops/env' }).get('/diagnostics', context => {
    const requestId = getRequestMeta(context).requestId
    const auth = getAuth(context)

    if (auth.mode !== 'admin') {
      return {
        requestId,
        mode: 'demo' as const,
        services: SERVICES_TO_REPORT.map(service => ({
          service,
          features: [],
          issueCount: 0,
          errorCount: 0,
          warningCount: 0,
          issues: [],
        })),
        generatedAt: new Date().toISOString(),
      }
    }

    requireAdmin(context)

    const env = process.env as Record<string, string | undefined>
    const services = SERVICES_TO_REPORT.map(service => summarize(diagnoseServiceEnv(service, env)))

    return {
      requestId,
      mode: 'admin' as const,
      services,
      totals: {
        errorCount: services.reduce((sum, s) => sum + s.errorCount, 0),
        warningCount: services.reduce((sum, s) => sum + s.warningCount, 0),
      },
      generatedAt: new Date().toISOString(),
    }
  })
