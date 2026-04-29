import { afterEach, describe, expect, it } from 'bun:test'
import { isBlockedMetadataAddress, scrapeArticleMetadata } from './scrape-article-metadata'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('scrapeArticleMetadata', () => {
  it('extracts multiple image and favicon candidates from meta tags and JSON-LD', async () => {
    globalThis.fetch = (async () =>
      new Response(
        `<!doctype html>
        <html>
          <head>
            <title>Fallback title</title>
            <link rel="canonical" href="/article/canonical" />
            <link rel="icon" href="/favicon.ico" />
            <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
            <meta property="og:title" content="Macro signal headline" />
            <meta property="og:description" content="Important context for a macro release." />
            <meta property="og:image:secure_url" content="https://cdn.signals.example/og-image-secure.png" />
            <meta property="og:image" content="/og-image.png" />
            <meta property="og:image:alt" content="Macro chart preview" />
            <meta name="twitter:image:src" content="/twitter-image.png" />
            <meta property="og:site_name" content="Signal Desk" />
            <meta property="article:published_time" content="2026-04-09T07:30:00.000Z" />
            <script type="application/ld+json">
              {
                "@context": "https://schema.org",
                "@type": "NewsArticle",
                "author": { "name": "Jane Macro" },
                "datePublished": "2026-04-09T07:30:00.000Z",
                "image": [
                  "https://signals.example/json-ld-image.png"
                ]
              }
            </script>
          </head>
          <body></body>
        </html>`,
        {
          status: 200,
          headers: {
            'content-type': 'text/html; charset=utf-8',
          },
        }
      )) as unknown as typeof fetch

    const result = await scrapeArticleMetadata({
      url: 'https://signals.example/article?id=1',
      requestId: 'req-metadata',
      timeoutMs: 2500,
      maxBytes: 8192,
      userAgent: 'finance-os-tests/1.0',
      resolveHostname: async () => ['93.184.216.34'],
    })

    expect(result.status).toBe('fetched')
    expect(result.card).toEqual({
      title: 'Macro signal headline',
      description: 'Important context for a macro release.',
      canonicalUrl: 'https://signals.example/article/canonical',
      imageUrl: 'https://cdn.signals.example/og-image-secure.png',
      imageCandidates: [
        'https://cdn.signals.example/og-image-secure.png',
        'https://signals.example/og-image.png',
        'https://signals.example/twitter-image.png',
        'https://signals.example/json-ld-image.png',
      ],
      imageAlt: 'Macro chart preview',
      siteName: 'Signal Desk',
      displayUrl: 'signals.example',
      faviconUrl: 'https://signals.example/favicon.ico',
      faviconCandidates: [
        'https://signals.example/favicon.ico',
        'https://signals.example/apple-touch-icon.png',
      ],
      publishedAt: '2026-04-09T07:30:00.000Z',
      author: 'Jane Macro',
      articleType: 'NewsArticle',
    })
    expect(result.fetchedAt).not.toBeNull()
  })

  it('returns a minimal card when the origin is not HTML', async () => {
    globalThis.fetch = (async () =>
      new Response('{"ok":true}', {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      })) as unknown as typeof fetch

    const result = await scrapeArticleMetadata({
      url: 'https://signals.example/data.json',
      requestId: 'req-metadata-json',
      timeoutMs: 2500,
      maxBytes: 8192,
      userAgent: 'finance-os-tests/1.0',
      resolveHostname: async () => ['93.184.216.34'],
    })

    expect(result.status).toBe('skipped')
    expect(result.card.displayUrl).toBe('signals.example')
    expect(result.card.title).toBe('signals.example')
    expect(result.card.faviconUrl).toBe('https://signals.example/favicon.ico')
    expect(result.card.faviconCandidates).toEqual(['https://signals.example/favicon.ico'])
  })

  it('skips localhost, private IP, and cloud metadata URLs before fetch', async () => {
    let fetchCalls = 0
    const fetchImpl = async () => {
      fetchCalls += 1
      return new Response('<html></html>', {
        status: 200,
        headers: {
          'content-type': 'text/html',
        },
      })
    }

    for (const url of [
      'http://localhost/article',
      'http://127.0.0.1/article',
      'http://10.0.0.5/article',
      'http://169.254.169.254/latest/meta-data',
    ]) {
      const result = await scrapeArticleMetadata({
        url,
        requestId: 'req-ssrf',
        timeoutMs: 2500,
        maxBytes: 8192,
        userAgent: 'finance-os-tests/1.0',
        fetchImpl,
      })

      expect(result.status).toBe('skipped')
    }

    expect(fetchCalls).toBe(0)
  })

  it('rejects redirects to private network targets', async () => {
    const result = await scrapeArticleMetadata({
      url: 'https://signals.example/redirect',
      requestId: 'req-redirect-ssrf',
      timeoutMs: 2500,
      maxBytes: 8192,
      userAgent: 'finance-os-tests/1.0',
      resolveHostname: async hostname =>
        hostname === 'signals.example' ? ['93.184.216.34'] : ['127.0.0.1'],
      fetchImpl: async () =>
        new Response(null, {
          status: 302,
          headers: {
            location: 'http://127.0.0.1/admin',
          },
        }),
    })

    expect(result.status).toBe('skipped')
  })

  it('classifies private and link-local addresses as blocked', () => {
    expect(isBlockedMetadataAddress('127.0.0.1')).toBe(true)
    expect(isBlockedMetadataAddress('169.254.169.254')).toBe(true)
    expect(isBlockedMetadataAddress('10.1.2.3')).toBe(true)
    expect(isBlockedMetadataAddress('::1')).toBe(true)
    expect(isBlockedMetadataAddress('fe80::1')).toBe(true)
    expect(isBlockedMetadataAddress('93.184.216.34')).toBe(false)
  })
})
