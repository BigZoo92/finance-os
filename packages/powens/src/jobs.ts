export const POWENS_JOB_QUEUE_KEY = 'powens:jobs'

export type PowensJob =
  | {
      type: 'powens.syncConnection'
      connectionId: string
    }
  | {
      type: 'powens.syncAll'
    }

export const serializePowensJob = (job: PowensJob) => {
  return JSON.stringify(job)
}

export const parsePowensJob = (value: string): PowensJob | null => {
  try {
    const parsed = JSON.parse(value) as PowensJob

    if (parsed.type === 'powens.syncAll') {
      return parsed
    }

    if (
      parsed.type === 'powens.syncConnection' &&
      typeof parsed.connectionId === 'string' &&
      parsed.connectionId.length > 0
    ) {
      return parsed
    }

    return null
  } catch {
    return null
  }
}
