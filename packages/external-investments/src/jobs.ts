import type { ExternalInvestmentProvider } from './types'

export const EXTERNAL_INVESTMENTS_JOB_QUEUE_KEY = 'external-investments:jobs'

export type ExternalInvestmentsJob =
  | {
      type: 'externalInvestments.syncAll'
      requestId?: string
      fullResync?: boolean
    }
  | {
      type: 'externalInvestments.syncProvider'
      provider: ExternalInvestmentProvider
      requestId?: string
      fullResync?: boolean
    }
  | {
      type: 'externalInvestments.syncConnection'
      provider: ExternalInvestmentProvider
      connectionId: string
      requestId?: string
      fullResync?: boolean
    }

const isProvider = (value: unknown): value is ExternalInvestmentProvider =>
  value === 'ibkr' || value === 'binance'

const withOptionalJobFields = <TJob extends ExternalInvestmentsJob>(
  target: TJob,
  source: Record<string, unknown>
): TJob => {
  const next = { ...target } as TJob & { requestId?: string; fullResync?: boolean }
  if (typeof source.requestId === 'string' && source.requestId.length > 0) {
    next.requestId = source.requestId
  }
  if (source.fullResync === true) {
    next.fullResync = true
  }
  return next
}

export const parseExternalInvestmentsJob = (raw: string): ExternalInvestmentsJob | null => {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (parsed.type === 'externalInvestments.syncAll') {
      return withOptionalJobFields({ type: 'externalInvestments.syncAll' }, parsed)
    }
    if (parsed.type === 'externalInvestments.syncProvider' && isProvider(parsed.provider)) {
      return withOptionalJobFields(
        {
          type: 'externalInvestments.syncProvider',
          provider: parsed.provider,
        },
        parsed
      )
    }
    if (
      parsed.type === 'externalInvestments.syncConnection' &&
      isProvider(parsed.provider) &&
      typeof parsed.connectionId === 'string' &&
      parsed.connectionId.length > 0
    ) {
      return withOptionalJobFields(
        {
          type: 'externalInvestments.syncConnection',
          provider: parsed.provider,
          connectionId: parsed.connectionId,
        },
        parsed
      )
    }
    return null
  } catch {
    return null
  }
}

export const serializeExternalInvestmentsJob = (job: ExternalInvestmentsJob) => JSON.stringify(job)
