import { afterEach, describe, expect, it } from 'bun:test'
import { scrapeArticleMetadata } from './scrape-article-metadata'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('scrapeArticleMetadata', () => {
  it('extracts OG fields, canonical URLs, favicon, and JSON-LD article metadata', async () => {
    globalThis.fetch = (async () =>
      new Response(
        `<!doctype html>
        <html>
          <head>
            <title>Fallback title</title>
            <link rel="canonical" href="/article/canonical" />
            <link rel="icon" href="/favicon.ico" />
            <meta property="og:title" content="Macro signal headline" />
            <meta property="og:description" content="Important context for a macro release." />
            <meta property="og:image" content="/og-image.png" />
            <meta property="og:site_name" content="Signal Desk" />
            <meta property="article:published_time" content="2026-04-09T07:30:00.000Z" />
            <script type="application/ld+json">
              {
                "@context": "https://schema.org",
                "@type": "NewsArticle",
                "author": { "name": "Jane Macro" },
                "datePublished": "2026-04-09T07:30:00.000Z"
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
    })

    expect(result.status).toBe('fetched')
    expect(result.card).toEqual({
      title: 'Macro signal headline',
      description: 'Important context for a macro release.',
      canonicalUrl: 'https://signals.example/article/canonical',
      imageUrl: 'https://signals.example/og-image.png',
      siteName: 'Signal Desk',
      displayUrl: 'signals.example',
      faviconUrl: 'https://signals.example/favicon.ico',
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
    })

    expect(result.status).toBe('skipped')
    expect(result.card.displayUrl).toBe('signals.example')
    expect(result.card.title).toBe('signals.example')
  })
})
