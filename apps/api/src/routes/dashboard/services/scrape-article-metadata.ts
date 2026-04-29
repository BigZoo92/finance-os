import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { load } from 'cheerio'
import {
  canonicalizeUrl,
  extractHostname,
  trimToLength,
  uniqueStrings,
} from '../domain/news-helpers'
import type { NewsMetadataCard, NewsMetadataFetchStatus } from '../domain/news-types'

const HEAD_END_PATTERN = /<\/head>/i
const MAX_METADATA_REDIRECTS = 3

type MetadataFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>
type ResolveMetadataHostname = (hostname: string) => Promise<string[]>

class UnsafeMetadataUrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnsafeMetadataUrlError'
  }
}

const resolveHostnameWithDns: ResolveMetadataHostname = async hostname => {
  const addresses = await lookup(hostname, {
    all: true,
    verbatim: true,
  })

  return addresses.map(address => address.address)
}

const parseIpv4Parts = (address: string) => {
  const parts = address.split('.')
  if (parts.length !== 4) {
    return null
  }

  const parsed = parts.map(part => {
    if (!/^\d{1,3}$/.test(part)) {
      return null
    }

    const value = Number(part)
    return Number.isInteger(value) && value >= 0 && value <= 255 ? value : null
  })

  if (parsed.some(value => value === null)) {
    return null
  }

  return parsed as [number, number, number, number]
}

export const isBlockedMetadataAddress = (address: string) => {
  const normalized = address
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
  const ipv4Mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  const ipv4Address = ipv4Mapped?.[1] ?? normalized
  const ipv4 = parseIpv4Parts(ipv4Address)

  if (ipv4) {
    const [a, b] = ipv4
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    )
  }

  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fe80:') ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd')
  )
}

const assertSafeMetadataUrl = async ({
  url,
  resolveHostname,
}: {
  url: string
  resolveHostname: ResolveMetadataHostname
}) => {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new UnsafeMetadataUrlError('metadata URL is invalid')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new UnsafeMetadataUrlError('metadata URL protocol is not allowed')
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    throw new UnsafeMetadataUrlError('metadata URL hostname is local')
  }

  if (isIP(hostname)) {
    if (isBlockedMetadataAddress(hostname)) {
      throw new UnsafeMetadataUrlError('metadata URL address is private')
    }
    return parsed
  }

  const addresses = await resolveHostname(hostname)
  if (addresses.length === 0 || addresses.some(isBlockedMetadataAddress)) {
    throw new UnsafeMetadataUrlError('metadata URL resolves to a private address')
  }

  return parsed
}

const fetchSafeMetadataResponse = async ({
  url,
  requestId,
  timeoutMs,
  userAgent,
  fetchImpl,
  resolveHostname,
  redirectsRemaining,
}: {
  url: string
  requestId: string
  timeoutMs: number
  userAgent: string
  fetchImpl: MetadataFetch
  resolveHostname: ResolveMetadataHostname
  redirectsRemaining: number
}): Promise<{
  response: Response
  finalUrl: string
}> => {
  const parsedUrl = await assertSafeMetadataUrl({
    url,
    resolveHostname,
  })

  const response = await fetchImpl(parsedUrl, {
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'manual',
    credentials: 'omit',
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'user-agent': userAgent,
      'x-request-id': requestId,
    },
  })

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location')
    if (!location) {
      return {
        response,
        finalUrl: parsedUrl.toString(),
      }
    }

    if (redirectsRemaining <= 0) {
      throw new UnsafeMetadataUrlError('metadata redirect limit exceeded')
    }

    return fetchSafeMetadataResponse({
      url: new URL(location, parsedUrl).toString(),
      requestId,
      timeoutMs,
      userAgent,
      fetchImpl,
      resolveHostname,
      redirectsRemaining: redirectsRemaining - 1,
    })
  }

  return {
    response,
    finalUrl: parsedUrl.toString(),
  }
}

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
  return uniqueStrings(candidates.map(candidate => resolveAbsoluteUrl(baseUrl, candidate)))
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
          publishedAt: typeof entry.datePublished === 'string' ? entry.datePublished : null,
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
  fetchImpl = fetch,
  resolveHostname = resolveHostnameWithDns,
}: {
  url: string
  requestId: string
  timeoutMs: number
  maxBytes: number
  userAgent: string
  fetchImpl?: MetadataFetch
  resolveHostname?: ResolveMetadataHostname
}): Promise<{
  status: NewsMetadataFetchStatus
  card: NewsMetadataCard
  fetchedAt: Date | null
}> => {
  const minimalCard = buildMinimalCard(url)

  try {
    const { response, finalUrl } = await fetchSafeMetadataResponse({
      url,
      requestId,
      timeoutMs,
      userAgent,
      fetchImpl,
      resolveHostname,
      redirectsRemaining: MAX_METADATA_REDIRECTS,
    })

    if (!response.ok) {
      return {
        status:
          response.status === 401 || response.status === 403 || response.status === 429
            ? 'skipped'
            : 'failed',
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
      resolveMetaContent($, ['meta[property="og:title"]', 'meta[name="twitter:title"]']) ??
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
      finalUrl,
      resolveLinkHref($, ['link[rel="canonical"]']) ??
        resolveMetaContent($, ['meta[property="og:url"]'])
    )
    const imageCandidates = resolveAbsoluteUrls(finalUrl, [
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
      resolveMetaContent($, ['meta[property="og:image:alt"]', 'meta[name="twitter:image:alt"]']) ??
      null
    const defaultFaviconUrl = buildDefaultFaviconUrl(finalUrl)
    const faviconCandidates = resolveAbsoluteUrls(finalUrl, [
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
      extractHostname(canonicalUrl ?? finalUrl)
    const author =
      jsonLd?.author ??
      resolveMetaContent($, ['meta[name="author"]', 'meta[property="article:author"]'])
    const publishedAt =
      jsonLd?.publishedAt ?? resolveMetaContent($, ['meta[property="article:published_time"]'])

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
        displayUrl: extractHostname(canonicalUrl ?? finalUrl) ?? finalUrl,
        faviconUrl,
        faviconCandidates,
        publishedAt,
        author,
        articleType: jsonLd?.articleType ?? null,
      },
      fetchedAt: new Date(),
    }
  } catch (error) {
    return {
      status: error instanceof UnsafeMetadataUrlError ? 'skipped' : 'failed',
      card: minimalCard,
      fetchedAt: null,
    }
  }
}
