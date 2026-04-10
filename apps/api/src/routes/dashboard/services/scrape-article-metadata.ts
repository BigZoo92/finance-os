import { load } from 'cheerio'
import {
  canonicalizeUrl,
  extractHostname,
  trimToLength,
  uniqueStrings,
} from '../domain/news-helpers'
import type { NewsMetadataCard, NewsMetadataFetchStatus } from '../domain/news-types'

const HEAD_END_PATTERN = /<\/head>/i

const readPartialBody = async ({
  response,
  maxBytes,
}: {
  response: Response
  maxBytes: number
}) => {
  if (!response.body) {
    return ''
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  let seenHeadEnd = false

  while (total < maxBytes && !seenHeadEnd) {
    const { done, value } = await reader.read()
    if (done || !value) {
      break
    }

    const slice = value.subarray(0, Math.min(value.length, maxBytes - total))
    chunks.push(slice)
    total += slice.length

    const preview = new TextDecoder('utf-8', { fatal: false }).decode(slice)
    if (HEAD_END_PATTERN.test(preview)) {
      seenHeadEnd = true
    }
  }

  reader.releaseLock()
  return new TextDecoder('utf-8', { fatal: false }).decode(Buffer.concat(chunks))
}

const resolveMetaContent = ($: ReturnType<typeof load>, selectors: string[]) => {
  for (const selector of selectors) {
    const value = $(selector).attr('content')?.trim()
    if (value) {
      return value
    }
  }

  return null
}

const collectMetaContents = ($: ReturnType<typeof load>, selectors: string[]) => {
  const values: string[] = []

  for (const selector of selectors) {
    $(selector).each((_, element) => {
      const value = $(element).attr('content')?.trim()
      if (value) {
        values.push(value)
      }
    })
  }

  return uniqueStrings(values)
}

const resolveLinkHref = ($: ReturnType<typeof load>, selectors: string[]) => {
  for (const selector of selectors) {
    const value = $(selector).attr('href')?.trim()
    if (value) {
      return value
    }
  }

  return null
}

const collectLinkHrefs = ($: ReturnType<typeof load>, selectors: string[]) => {
  const values: string[] = []

  for (const selector of selectors) {
    $(selector).each((_, element) => {
      const value = $(element).attr('href')?.trim()
      if (value) {
        values.push(value)
      }
    })
  }

  return uniqueStrings(values)
}

const resolveAbsoluteUrl = (baseUrl: string, candidate: string | null) => {
  if (!candidate) {
    return null
  }

  try {
    return new URL(candidate, baseUrl).toString()
  } catch {
    return null
  }
}

const resolveAbsoluteUrls = (baseUrl: string, candidates: Array<string | null>) => {
  return uniqueStrings(
    candidates.map(candidate => resolveAbsoluteUrl(baseUrl, candidate))
  )
}

const buildDefaultFaviconUrl = (value: string) => {
  try {
    return new URL('/favicon.ico', value).toString()
  } catch {
    return null
  }
}

const flattenJsonLdEntries = (value: unknown): Array<Record<string, unknown>> => {
  if (Array.isArray(value)) {
    return value.flatMap(entry => flattenJsonLdEntries(entry))
  }

  if (!value || typeof value !== 'object') {
    return []
  }

  const entry = value as Record<string, unknown>
  const graph = Array.isArray(entry['@graph']) ? flattenJsonLdEntries(entry['@graph']) : []

  return [entry, ...graph]
}

const extractJsonLdImageCandidates = (value: unknown): string[] => {
  if (typeof value === 'string') {
    return [value]
  }

  if (Array.isArray(value)) {
    return uniqueStrings(value.flatMap(entry => extractJsonLdImageCandidates(entry)))
  }

  if (!value || typeof value !== 'object') {
    return []
  }

  const image = value as Record<string, unknown>

  return uniqueStrings([
    typeof image.url === 'string' ? image.url : null,
    typeof image.contentUrl === 'string' ? image.contentUrl : null,
  ])
}

const parseJsonLd = ($: ReturnType<typeof load>) => {
  const scripts = $('script[type="application/ld+json"]').toArray()
  for (const script of scripts) {
    const raw = $(script).text().trim()
    if (!raw) {
      continue
    }

    try {
      const parsed = JSON.parse(raw) as unknown
      const entries = flattenJsonLdEntries(parsed)
      for (const entry of entries) {
        const type = typeof entry['@type'] === 'string' ? entry['@type'] : null
        if (type !== 'Article' && type !== 'NewsArticle') {
          continue
        }

        return {
          articleType: type,
          author:
            typeof entry.author === 'string'
              ? entry.author
              : entry.author &&
                  typeof entry.author === 'object' &&
                  'name' in entry.author &&
                  typeof (entry.author as { name?: unknown }).name === 'string'
                ? (entry.author as { name: string }).name
                : null,
          publishedAt:
            typeof entry.datePublished === 'string' ? entry.datePublished : null,
          imageCandidates: extractJsonLdImageCandidates(entry.image),
        }
      }
    } catch {}
  }

  return null
}

const buildMinimalCard = (url: string): NewsMetadataCard => {
  const defaultFaviconUrl = buildDefaultFaviconUrl(url)

  return {
    title: extractHostname(url) ?? url,
    description: null,
    canonicalUrl: canonicalizeUrl(url),
    imageUrl: null,
    imageCandidates: [],
    imageAlt: null,
    siteName: extractHostname(url),
    displayUrl: extractHostname(url) ?? url,
    faviconUrl: defaultFaviconUrl,
    faviconCandidates: defaultFaviconUrl ? [defaultFaviconUrl] : [],
    publishedAt: null,
    author: null,
    articleType: null,
  }
}

export const scrapeArticleMetadata = async ({
  url,
  requestId,
  timeoutMs,
  maxBytes,
  userAgent,
}: {
  url: string
  requestId: string
  timeoutMs: number
  maxBytes: number
  userAgent: string
}): Promise<{
  status: NewsMetadataFetchStatus
  card: NewsMetadataCard
  fetchedAt: Date | null
}> => {
  const minimalCard = buildMinimalCard(url)

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': userAgent,
        'x-request-id': requestId,
      },
    })

    if (!response.ok) {
      return {
        status: response.status === 401 || response.status === 403 || response.status === 429 ? 'skipped' : 'failed',
        card: minimalCard,
        fetchedAt: null,
      }
    }

    const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
    if (!contentType.includes('html')) {
      return {
        status: 'skipped',
        card: minimalCard,
        fetchedAt: null,
      }
    }

    const html = await readPartialBody({
      response,
      maxBytes,
    })
    const $ = load(html)
    const jsonLd = parseJsonLd($)
    const title = trimToLength(
      resolveMetaContent($, [
        'meta[property="og:title"]',
        'meta[name="twitter:title"]',
      ]) ??
        $('title').text().trim() ??
        minimalCard.title,
      240
    )
    const descriptionValue =
      resolveMetaContent($, [
        'meta[property="og:description"]',
        'meta[name="twitter:description"]',
        'meta[name="description"]',
      ]) ?? null

    const canonicalUrl = resolveAbsoluteUrl(
      url,
      resolveLinkHref($, ['link[rel="canonical"]']) ??
        resolveMetaContent($, ['meta[property="og:url"]'])
    )
    const imageCandidates = resolveAbsoluteUrls(url, [
      ...collectMetaContents($, [
        'meta[property="og:image:secure_url"]',
        'meta[property="og:image:url"]',
        'meta[property="og:image"]',
        'meta[name="twitter:image:src"]',
        'meta[name="twitter:image"]',
        'meta[itemprop="image"]',
      ]),
      ...collectLinkHrefs($, ['link[rel="image_src"]']),
      ...(jsonLd?.imageCandidates ?? []),
    ])
    const imageUrl = imageCandidates[0] ?? null
    const imageAlt =
      resolveMetaContent($, [
        'meta[property="og:image:alt"]',
        'meta[name="twitter:image:alt"]',
      ]) ?? null
    const defaultFaviconUrl = buildDefaultFaviconUrl(url)
    const faviconCandidates = resolveAbsoluteUrls(url, [
      ...collectLinkHrefs($, [
        'link[rel="icon"]',
        'link[rel="shortcut icon"]',
        'link[rel="apple-touch-icon"]',
        'link[rel="apple-touch-icon-precomposed"]',
        'link[rel="mask-icon"]',
        'link[rel="fluid-icon"]',
      ]),
      ...collectMetaContents($, ['meta[name="msapplication-TileImage"]']),
      defaultFaviconUrl,
    ])
    const faviconUrl = faviconCandidates[0] ?? null
    const siteName =
      resolveMetaContent($, ['meta[property="og:site_name"]']) ??
      extractHostname(canonicalUrl ?? url)
    const author =
      jsonLd?.author ??
      resolveMetaContent($, [
        'meta[name="author"]',
        'meta[property="article:author"]',
      ])
    const publishedAt =
      jsonLd?.publishedAt ??
      resolveMetaContent($, ['meta[property="article:published_time"]'])

    return {
      status: 'fetched',
      card: {
        title,
        description: descriptionValue ? trimToLength(descriptionValue, 320) : null,
        canonicalUrl: canonicalUrl ?? minimalCard.canonicalUrl,
        imageUrl,
        imageCandidates,
        imageAlt,
        siteName,
        displayUrl: extractHostname(canonicalUrl ?? url) ?? url,
        faviconUrl,
        faviconCandidates,
        publishedAt,
        author,
        articleType: jsonLd?.articleType ?? null,
      },
      fetchedAt: new Date(),
    }
  } catch {
    return {
      status: 'failed',
      card: minimalCard,
      fetchedAt: null,
    }
  }
}
