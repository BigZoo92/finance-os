import type { NewsMetadataCard, NewsMetadataFetchStatus } from './news-types'
import { extractHostname, uniqueStrings } from './news-helpers'

const toTrimmedStringOrNull = (value: unknown) => {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

const toStringArray = (value: unknown) => {
  if (!Array.isArray(value)) {
    return []
  }

  return uniqueStrings(
    value.map(entry => (typeof entry === 'string' ? entry : null))
  )
}

export const normalizeNewsMetadataCard = (
  value: unknown
): NewsMetadataCard | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const source = value as Record<string, unknown>
  const canonicalUrl = toTrimmedStringOrNull(source.canonicalUrl)
  const siteName = toTrimmedStringOrNull(source.siteName)
  const imageCandidates = uniqueStrings([
    toTrimmedStringOrNull(source.imageUrl),
    ...toStringArray(source.imageCandidates),
  ])
  const faviconCandidates = uniqueStrings([
    toTrimmedStringOrNull(source.faviconUrl),
    ...toStringArray(source.faviconCandidates),
  ])
  const displayUrl =
    toTrimmedStringOrNull(source.displayUrl) ??
    extractHostname(canonicalUrl) ??
    siteName ??
    'source'

  return {
    title: toTrimmedStringOrNull(source.title) ?? displayUrl,
    description: toTrimmedStringOrNull(source.description),
    canonicalUrl,
    imageUrl: imageCandidates[0] ?? null,
    imageCandidates,
    imageAlt: toTrimmedStringOrNull(source.imageAlt),
    siteName,
    displayUrl,
    faviconUrl: faviconCandidates[0] ?? null,
    faviconCandidates,
    publishedAt: toTrimmedStringOrNull(source.publishedAt),
    author: toTrimmedStringOrNull(source.author),
    articleType: toTrimmedStringOrNull(source.articleType),
  }
}

export const getNewsMetadataCardRichness = (
  value: NewsMetadataCard | null
) => {
  if (!value) {
    return -1
  }

  let score = 0

  if (value.title) {
    score += 1
  }
  if (value.description) {
    score += 3
  }
  if (value.canonicalUrl) {
    score += 1
  }
  if (value.imageUrl) {
    score += 4
  }
  score += Math.min(value.imageCandidates.length, 3)
  if (value.imageAlt) {
    score += 1
  }
  if (value.siteName) {
    score += 1
  }
  if (value.faviconUrl) {
    score += 2
  }
  score += Math.min(value.faviconCandidates.length, 2)
  if (value.publishedAt) {
    score += 1
  }
  if (value.author) {
    score += 1
  }
  if (value.articleType) {
    score += 1
  }

  return score
}

export const selectPreferredNewsMetadata = (input: {
  existingStatus: NewsMetadataFetchStatus
  existingCard: unknown
  existingFetchedAt: Date | null
  incomingStatus: NewsMetadataFetchStatus
  incomingCard: NewsMetadataCard | null
  incomingFetchedAt: Date | null
}): {
  status: NewsMetadataFetchStatus
  card: NewsMetadataCard | null
  fetchedAt: Date | null
} => {
  const existingCard = normalizeNewsMetadataCard(input.existingCard)
  const incomingCard = normalizeNewsMetadataCard(input.incomingCard)
  const existingFetched = input.existingStatus === 'fetched'
  const incomingFetched = input.incomingStatus === 'fetched'

  if (existingFetched && !incomingFetched) {
    return {
      status: input.existingStatus,
      card: existingCard,
      fetchedAt: input.existingFetchedAt,
    }
  }

  if (incomingFetched && !existingFetched) {
    return {
      status: input.incomingStatus,
      card: incomingCard,
      fetchedAt: input.incomingFetchedAt,
    }
  }

  const existingScore = getNewsMetadataCardRichness(existingCard)
  const incomingScore = getNewsMetadataCardRichness(incomingCard)
  const useIncoming = incomingScore > existingScore

  if (useIncoming) {
    return {
      status: input.incomingStatus,
      card: incomingCard,
      fetchedAt: input.incomingFetchedAt,
    }
  }

  return {
    status: input.existingStatus,
    card: existingCard,
    fetchedAt: input.existingFetchedAt,
  }
}
