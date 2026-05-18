import { describe, expect, it } from 'bun:test'
import { __testing } from './free-firehose'

const { adaptNewsItemToSignalItem, buildHistoryAdapter } = __testing

describe('adaptNewsItemToSignalItem', () => {
  it('maps a free news provider raw item to a signal_item insert payload', () => {
    const raw = {
      provider: 'gdelt_doc' as const,
      providerArticleId: 'gdelt-abc',
      providerUrl: 'https://example.org/article',
      canonicalUrl: 'https://example.org/article',
      sourceName: 'Example',
      sourceDomain: 'example.org',
      sourceType: 'media' as const,
      title: 'breaking news',
      summary: 'summary text',
      contentSnippet: 'snippet',
      language: 'en',
      country: null,
      region: null,
      geoScope: 'global' as const,
      publishedAt: new Date('2026-05-12T12:00:00Z'),
      metadata: null,
      rawPayload: null,
    }
    const payload = adaptNewsItemToSignalItem(raw, 'firehose-run-1', 42)
    expect(payload.sourceProvider).toBe('gdelt_doc')
    expect(payload.dedupeKey).toBe('gdelt_doc:gdelt-abc')
    expect(payload.signalDomain).toBe('free_firehose')
    expect(payload.advisorIngestStatus).toBe('skipped')
    expect(payload.ingestionRunId).toBe(42)
    expect(payload.scope).toBe('admin')
    expect(payload.provenance).toMatchObject({
      provider: 'gdelt_doc',
      sourceName: 'Example',
      runId: 'firehose-run-1',
    })
  })
})

/**
 * Regression test for the production 500 bug where the weekly quota count
 * query was serialising a JS `Date` via `Date.prototype.toString()` and
 * Postgres rejected the resulting localized string. The fix uses SQL
 * `now() - make_interval(...)` so no JS Date ever enters the parameter list.
 *
 * We assert against the captured SQL chunks/params instead of running a real
 * query: any future regression that re-introduces a JS Date to the param
 * binding will fail this test deterministically without needing a live DB.
 */
describe('buildHistoryAdapter.countLastNDays (regression: PG Date binding)', () => {
  type CapturedSqlPart = unknown
  const captureSelectBuilder = () => {
    const captured: { sqlParts: CapturedSqlPart[]; params: CapturedSqlPart[] } = {
      sqlParts: [],
      params: [],
    }
    const dbStub = {
      select: () => ({
        from: () => ({
          where: (sqlExpr: { queryChunks?: CapturedSqlPart[] }) => {
            captured.sqlParts = sqlExpr.queryChunks ?? []
            // postgres-js / drizzle store params interleaved in queryChunks
            // — Param instances carry the JS value via `.value`. Pull them
            // out for assertion.
            captured.params = (sqlExpr.queryChunks ?? [])
              .map(chunk => {
                if (chunk && typeof chunk === 'object' && 'value' in chunk) {
                  return (chunk as { value: unknown }).value
                }
                return null
              })
              .filter(value => value !== null)
            return Promise.resolve([{ count: 0 }])
          },
        }),
      }),
    }
    return { dbStub, captured }
  }

  it('does not bind a JS Date for the week-window filter', async () => {
    const { dbStub, captured } = captureSelectBuilder()
    // The cast widens the stub to ApiDb for the adapter signature; only
    // .select().from().where() are exercised so this is safe.
    const adapter = buildHistoryAdapter({ db: dbStub as unknown as never })
    const count = await adapter.countLastNDays(7)
    expect(count).toBe(0)
    // No JS Date — Drizzle would otherwise interpolate `.toString()` and
    // Postgres would reject it with status 22008.
    for (const param of captured.params) {
      expect(param instanceof Date).toBe(false)
      // Date.prototype.toString() leaks the timezone abbreviation.
      if (typeof param === 'string') {
        expect(param).not.toMatch(/GMT[+-]\d{4}/)
      }
    }
  })

  it('returns 0 when the query yields no rows (empty table case)', async () => {
    const { dbStub } = captureSelectBuilder()
    const adapter = buildHistoryAdapter({ db: dbStub as unknown as never })
    const count = await adapter.countLastNDays(30)
    expect(count).toBe(0)
  })
})
