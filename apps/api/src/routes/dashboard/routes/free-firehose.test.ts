import { describe, expect, it } from 'bun:test'
import { __testing } from './free-firehose'

const { adaptNewsItemToSignalItem } = __testing

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
