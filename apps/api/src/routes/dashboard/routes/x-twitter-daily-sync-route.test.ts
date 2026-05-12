import { describe, expect, it } from 'bun:test'
import { __testing } from './x-twitter-daily-sync-route'

const { persistTweetsAsSignalItems } = __testing

type InsertRecord = { table: string; values: Record<string, unknown> }

const makeFakeDb = () => {
  const inserts: InsertRecord[] = []
  let shouldDedupe = false
  const db = {
    insert(table: { _: { name?: string } } | { name?: string } | string) {
      const tableName =
        typeof table === 'string'
          ? table
          : (table as { _?: { name?: string }; name?: string })._?.name ??
            (table as { name?: string }).name ??
            'unknown'
      return {
        values(values: Record<string, unknown>) {
          if (shouldDedupe) {
            shouldDedupe = false
            return Promise.reject(new Error('duplicate dedupe_key'))
          }
          inserts.push({ table: tableName, values })
          return Promise.resolve()
        },
      }
    },
  } as unknown as Parameters<typeof persistTweetsAsSignalItems>[0]['db']
  return { db, inserts, setShouldDedupe: () => (shouldDedupe = true) }
}

const tweet = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 't1',
  text: 'hello $SPY',
  authorId: 'A1',
  createdAt: '2026-05-12T12:00:00Z',
  sourceHandle: 'unusual_whales',
  score: 78,
  keptForAdvisor: true,
  lang: 'en',
  publicMetrics: { likeCount: 5, retweetCount: 1 } as Record<string, number>,
  ...overrides,
})

describe('persistTweetsAsSignalItems', () => {
  it('inserts a signal_item row per tweet with provenance + advisor flag', async () => {
    const { db, inserts } = makeFakeDb()
    const tweets = [tweet(), tweet({ id: 't2', text: 'unrelated', score: 20, keptForAdvisor: false })]
    const result = await persistTweetsAsSignalItems({
      db,
      runId: 'run-1',
      ingestionRunId: 42,
      tweets: tweets as Parameters<typeof persistTweetsAsSignalItems>[0]['tweets'],
      scope: 'admin',
    })
    expect(result.insertedCount).toBe(2)
    expect(result.dedupedCount).toBe(0)
    expect(inserts).toHaveLength(2)
    expect(inserts[0]?.values).toMatchObject({
      sourceProvider: 'x_twitter',
      externalId: 't1',
      author: '@unusual_whales',
      ingestionRunId: 42,
      scope: 'admin',
      advisorIngestStatus: 'pending', // keptForAdvisor=true
    })
    expect(inserts[1]?.values.advisorIngestStatus).toBe('skipped') // keptForAdvisor=false
    expect(inserts[1]?.values.signalDomain).toBe('social_filtered')
  })

  it('counts duplicate inserts as deduped without throwing', async () => {
    const fake = makeFakeDb()
    fake.setShouldDedupe()
    const result = await persistTweetsAsSignalItems({
      db: fake.db,
      runId: 'run-2',
      ingestionRunId: null,
      tweets: [tweet()] as Parameters<typeof persistTweetsAsSignalItems>[0]['tweets'],
      scope: 'admin',
    })
    expect(result.insertedCount).toBe(0)
    expect(result.dedupedCount).toBe(1)
  })

  it('returns zeros when no tweets to persist', async () => {
    const { db } = makeFakeDb()
    const result = await persistTweetsAsSignalItems({
      db,
      runId: 'run-3',
      ingestionRunId: null,
      tweets: [] as Parameters<typeof persistTweetsAsSignalItems>[0]['tweets'],
      scope: 'admin',
    })
    expect(result.insertedCount).toBe(0)
    expect(result.dedupedCount).toBe(0)
  })
})
