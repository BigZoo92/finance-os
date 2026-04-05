import { Elysia } from 'elysia'
import { createEnrichmentBulkTriageRoute } from './routes/bulk-triage'
import { createEnrichmentNotesRoute } from './routes/notes'
import { createEnrichmentRuntime, createEnrichmentRuntimePlugin } from './runtime'
import type { ApiDb } from '../dashboard/types'

export const createEnrichmentRoutes = ({
  db,
  bulkEnabled,
}: {
  db: ApiDb
  bulkEnabled: boolean
}) => {
  const runtime = createEnrichmentRuntime({
    db,
    bulkEnabled,
  })

  return new Elysia({ prefix: '/enrichment' })
    .use(createEnrichmentRuntimePlugin(runtime))
    .use(createEnrichmentNotesRoute())
    .use(createEnrichmentBulkTriageRoute())
}
