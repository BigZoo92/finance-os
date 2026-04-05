import { toErrorLogFields } from '../../../../observability/logger'

export type DiagnosticOutcome = 'ok' | 'degraded' | 'timeout' | 'auth_error' | 'provider_error'

export type DiagnosticIssueType = 'timeout' | 'auth' | 'provider'

export type DiagnosticsRequestContext = {
  requestId: string
  mode: 'demo' | 'admin'
}

export type DiagnosticsSnapshot = {
  provider: 'mock' | 'powens'
  outcome: DiagnosticOutcome
  guidance: string
  issueType?: DiagnosticIssueType
  retryable: boolean
}

export type DiagnosticProvider = {
  run: (context: DiagnosticsRequestContext) => Promise<DiagnosticsSnapshot>
}

export const diagnosticsDisabledSnapshot: DiagnosticsSnapshot = {
  provider: 'mock',
  outcome: 'degraded',
  guidance: 'Diagnostics temporarily disabled. Dashboard remains usable.',
  issueType: 'provider',
  retryable: false,
}

export type DiagnosticsServiceResponse = {
  enabled: boolean
  mode: 'demo' | 'admin'
  provider: 'mock' | 'powens'
  outcome: DiagnosticOutcome
  guidance: string
  issueType?: DiagnosticIssueType
  retryable: boolean
  lastCheckedAt: string
}

const resolveOutcomeFromError = (error: unknown): {
  outcome: Exclude<DiagnosticOutcome, 'ok' | 'degraded'>
  issueType: DiagnosticIssueType
  guidance: string
} => {
  const fields = toErrorLogFields({
    error,
    includeStack: false,
  })
  const merged = `${fields.errName ?? ''} ${fields.errMessage ?? ''}`.toLowerCase()

  if (merged.includes('timeout') || merged.includes('timed out') || merged.includes('abort')) {
    return {
      outcome: 'timeout',
      issueType: 'timeout',
      guidance: 'Network timeout while contacting provider. Retry is safe.',
    }
  }

  if (
    merged.includes('auth') ||
    merged.includes('credential') ||
    merged.includes('forbidden') ||
    merged.includes('unauthorized') ||
    merged.includes('token')
  ) {
    return {
      outcome: 'auth_error',
      issueType: 'auth',
      guidance: 'Provider credentials need admin attention. Reconnect the institution.',
    }
  }

  return {
    outcome: 'provider_error',
    issueType: 'provider',
    guidance: 'Provider failed unexpectedly. Dashboard stays available with degraded diagnostics.',
  }
}

export const createDiagnosticsService = ({
  diagnosticsEnabled,
  mockProvider,
  powensProvider,
  incrementOutcome,
}: {
  diagnosticsEnabled: boolean
  mockProvider: DiagnosticProvider
  powensProvider: DiagnosticProvider
  incrementOutcome: (outcome: DiagnosticOutcome) => Promise<void>
}) => {
  const run = async (context: DiagnosticsRequestContext): Promise<DiagnosticsServiceResponse> => {
    if (!context.requestId || context.requestId.trim().length === 0) {
      throw new Error('requestId is required for diagnostics')
    }

    if (!diagnosticsEnabled) {
      await incrementOutcome('degraded')
      return {
        ...diagnosticsDisabledSnapshot,
        enabled: false,
        mode: context.mode,
        lastCheckedAt: new Date().toISOString(),
      }
    }

    try {
      const provider = context.mode === 'admin' ? powensProvider : mockProvider
      const snapshot = await provider.run(context)
      await incrementOutcome(snapshot.outcome)
      return {
        ...snapshot,
        enabled: true,
        mode: context.mode,
        lastCheckedAt: new Date().toISOString(),
      }
    } catch (error) {
      const mapped = resolveOutcomeFromError(error)
      await incrementOutcome(mapped.outcome)

      return {
        provider: (context.mode === 'admin' ? 'powens' : 'mock') as 'powens' | 'mock',
        outcome: mapped.outcome,
        issueType: mapped.issueType,
        guidance: mapped.guidance,
        retryable: mapped.issueType !== 'auth',
        enabled: true,
        mode: context.mode,
        lastCheckedAt: new Date().toISOString(),
      }
    }
  }

  return {
    run,
  }
}
