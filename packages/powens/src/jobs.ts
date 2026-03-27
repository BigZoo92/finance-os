export const POWENS_JOB_QUEUE_KEY = 'powens:jobs'

export type PowensJob =
  | {
      type: 'powens.syncConnection'
      connectionId: string
      requestId?: string
      fullResync?: boolean
    }
  | {
      type: 'powens.syncAll'
      requestId?: string
    }

export const serializePowensJob = (job: PowensJob) => {
  return JSON.stringify(job)
}

export const parsePowensJob = (value: string): PowensJob | null => {
  try {
    const parsed = JSON.parse(value) as PowensJob

    if (parsed.type === 'powens.syncAll') {
      if (parsed.requestId !== undefined && typeof parsed.requestId !== 'string') {
        return null
      }

      return parsed
    }

    if (
      parsed.type === 'powens.syncConnection' &&
      typeof parsed.connectionId === 'string' &&
      parsed.connectionId.length > 0 &&
      (parsed.requestId === undefined || typeof parsed.requestId === 'string') &&
      (parsed.fullResync === undefined || typeof parsed.fullResync === 'boolean')
    ) {
      return parsed
    }

    return null
  } catch {
    return null
  }
}
