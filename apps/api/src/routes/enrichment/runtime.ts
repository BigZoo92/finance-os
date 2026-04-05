import { Elysia } from 'elysia'
import { createEnrichmentNotesRepository } from './repositories/enrichment-notes-repository'

export const createEnrichmentRuntime = ({
  db,
  bulkEnabled,
}: {
  db: Parameters<typeof createEnrichmentNotesRepository>[0]['db']
  bulkEnabled: boolean
}) => {
  return {
    repository: createEnrichmentNotesRepository({ db }),
    bulkEnabled,
  }
}

export type EnrichmentRuntime = ReturnType<typeof createEnrichmentRuntime>

export const createEnrichmentRuntimePlugin = (runtime: EnrichmentRuntime) => {
  return new Elysia().decorate('enrichment', runtime)
}

export const getEnrichmentRuntime = <T extends object>(context: T) => {
  const runtime = (context as T & { enrichment?: EnrichmentRuntime }).enrichment

  if (!runtime) {
    throw new Error('Enrichment runtime is missing from route context')
  }

  return runtime
}
