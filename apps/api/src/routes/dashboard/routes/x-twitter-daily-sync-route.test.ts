import { describe, expect, it } from 'bun:test'
import type { XTwitterFetch } from '../services/providers/x-twitter-profile-client'
import { __testing } from './x-twitter-daily-sync-route'

const { persistTweetsAsSignalItems, autoResolveMissingExternalIds } = __testing

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

// ---------------------------------------------------------------------------
// autoResolveMissingExternalIds — fires the batch X profile lookup before the
// daily sync so unresolved accounts get a chance to resolve in one shot.
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>

const makeAutoResolveDb = () => {
  const updates: Array<{ where: unknown; set: Row }> = []
  const ledgerWrites: Row[] = []
  const db = {
    update() {
      let setValues: Row = {}
      return {
        set(values: Row) {
          setValues = values
          return {
            where(predicate: unknown) {
              updates.push({ where: predicate, set: setValues })
              return Promise.resolve()
            },
          }
        },
      }
    },
    insert() {
      return {
        values(values: Row) {
          ledgerWrites.push(values)
          return Promise.resolve()
        },
      }
    },
  } as unknown as Parameters<typeof autoResolveMissingExternalIds>[0]['db']
  return { db, updates, ledgerWrites }
}

const profilePayload = (id: string, username: string, name: string) => ({
  id,
  username,
  name,
  description: `${name} bio`,
  profile_image_url: `https://x.com/${username}/avatar.jpg`,
  profile_banner_url: null,
  verified: false,
  verified_type: null,
  protected: false,
  public_metrics: {
    followers_count: 100,
    following_count: 10,
    tweet_count: 50,
    listed_count: 1,
  },
  created_at: '2020-01-01T00:00:00Z',
})

describe('autoResolveMissingExternalIds', () => {
  it('resolves unresolved accounts via the batch endpoint and persists profile metadata', async () => {
    const { db, updates, ledgerWrites } = makeAutoResolveDb()
    const fetcher: XTwitterFetch = async () => ({
      status: 200,
      body: {
        data: [profilePayload('100', 'alice', 'Alice'), profilePayload('200', 'bob', 'Bob')],
      },
    })
    const result = await autoResolveMissingExternalIds({
      db,
      accounts: [
        { signalSourceId: 1, handle: '@@alice', externalId: null, priority: 0 },
        { signalSourceId: 2, handle: 'bob', externalId: null, priority: 0 },
      ],
      bearerToken: 'tok',
      fetcher,
      requestId: 'req-1',
      now: new Date('2026-05-19T10:00:00Z'),
      userReadsToday: 0,
      maxUserReadsPerDay: 30,
    })
    expect(result.resolvedCount).toBe(2)
    expect(result.failedCount).toBe(0)
    const alice = result.accounts.find(a => a.signalSourceId === 1)
    const bob = result.accounts.find(a => a.signalSourceId === 2)
    expect(alice?.externalId).toBe('100')
    expect(alice?.handle).toBe('alice') // canonicalized: "@@alice" → "alice"
    expect(bob?.externalId).toBe('200')
    // Two row updates + one ledger write per batch.
    expect(updates).toHaveLength(2)
    expect(ledgerWrites).toHaveLength(1)
    expect(updates[0]?.set.externalId).toBe('100')
    expect(updates[0]?.set.handle).toBe('alice')
  })

  it('skips when the user-read cap is exhausted, surfacing nothing to the orchestrator', async () => {
    const { db, updates } = makeAutoResolveDb()
    let calls = 0
    const fetcher: XTwitterFetch = async () => {
      calls += 1
      return { status: 200, body: { data: [] } }
    }
    const result = await autoResolveMissingExternalIds({
      db,
      accounts: [{ signalSourceId: 1, handle: 'alice', externalId: null, priority: 0 }],
      bearerToken: 'tok',
      fetcher,
      requestId: 'req-2',
      now: new Date(),
      userReadsToday: 30,
      maxUserReadsPerDay: 30,
    })
    expect(calls).toBe(0)
    expect(result.resolvedCount).toBe(0)
    expect(updates).toHaveLength(0)
  })

  it('passes accounts through unchanged when none are missing externalId', async () => {
    const { db } = makeAutoResolveDb()
    let calls = 0
    const fetcher: XTwitterFetch = async () => {
      calls += 1
      return { status: 200, body: { data: [] } }
    }
    const accounts = [
      { signalSourceId: 1, handle: 'alice', externalId: '100', priority: 0 },
      { signalSourceId: 2, handle: 'bob', externalId: '200', priority: 0 },
    ]
    const result = await autoResolveMissingExternalIds({
      db,
      accounts,
      bearerToken: 'tok',
      fetcher,
      requestId: 'req-3',
      now: new Date(),
      userReadsToday: 0,
      maxUserReadsPerDay: 30,
    })
    expect(calls).toBe(0)
    expect(result.accounts).toEqual(accounts)
    expect(result.resolvedCount).toBe(0)
  })

  it('marks per-handle failures without aborting other resolutions', async () => {
    const { db } = makeAutoResolveDb()
    const fetcher: XTwitterFetch = async () => ({
      status: 200,
      body: {
        data: [profilePayload('100', 'alice', 'Alice')],
        errors: [{ value: 'ghost', title: 'Not Found' }],
      },
    })
    const result = await autoResolveMissingExternalIds({
      db,
      accounts: [
        { signalSourceId: 1, handle: 'alice', externalId: null, priority: 0 },
        { signalSourceId: 2, handle: 'ghost', externalId: null, priority: 0 },
      ],
      bearerToken: 'tok',
      fetcher,
      requestId: 'req-4',
      now: new Date(),
      userReadsToday: 0,
      maxUserReadsPerDay: 30,
    })
    expect(result.resolvedCount).toBe(1)
    expect(result.failedCount).toBe(1)
    // The orchestrator still gets the resolved alice + the unresolved ghost.
    expect(result.accounts.find(a => a.signalSourceId === 1)?.externalId).toBe('100')
    expect(result.accounts.find(a => a.signalSourceId === 2)?.externalId).toBe(null)
  })

  it('stops calling X after a batch-wide provider error (e.g. 401)', async () => {
    const { db, ledgerWrites } = makeAutoResolveDb()
    let calls = 0
    const fetcher: XTwitterFetch = async () => {
      calls += 1
      return { status: 401, body: {} }
    }
    const accounts = Array.from({ length: 150 }, (_, i) => ({
      signalSourceId: i + 1,
      handle: `user${i}`,
      externalId: null,
      priority: 0,
    }))
    const result = await autoResolveMissingExternalIds({
      db,
      accounts,
      bearerToken: 'tok',
      fetcher,
      requestId: 'req-5',
      now: new Date(),
      userReadsToday: 0,
      maxUserReadsPerDay: 100,
    })
    expect(calls).toBe(1) // stopped after first 401
    expect(result.resolvedCount).toBe(0)
    expect(ledgerWrites).toHaveLength(1)
    expect(ledgerWrites[0]?.errorCode).toBe('TOKEN_INVALID')
  })
})
