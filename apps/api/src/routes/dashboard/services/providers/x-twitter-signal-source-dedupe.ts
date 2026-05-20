import { normalizeXHandle } from './x-twitter-profile-client'

export type XSignalSourceDedupeInput = {
  id: number
  handle: string
  externalId: string | null
  enabled?: boolean
  priority?: number
  profileImageUrl?: string | null
  profileMetadata?: object | null
  profileCachedAt?: Date | string | null
  createdAt?: Date | string | null
  updatedAt?: Date | string | null
  tags?: string[]
}

export type XDedupedSourceReport = {
  duplicateId: number
  keptId: number
  rawHandle: string
  canonicalHandle: string
  reason: string
}

export type XInvalidSourceReport = {
  sourceId: number
  rawHandle: string
  reason: string
}

export type XDedupeResult<T extends XSignalSourceDedupeInput> = {
  sources: T[]
  dedupedSourcesCount: number
  dedupedSources: XDedupedSourceReport[]
  invalidSources: XInvalidSourceReport[]
}

const hasProfileData = (source: XSignalSourceDedupeInput): boolean =>
  source.profileImageUrl != null ||
  source.profileCachedAt != null ||
  (source.profileMetadata != null && Object.keys(source.profileMetadata).length > 0)

const timestamp = (value: Date | string | null | undefined): number => {
  if (value == null) return 0
  const date = value instanceof Date ? value : new Date(value)
  const time = date.getTime()
  return Number.isFinite(time) ? time : 0
}

const isStoredAsCanonical = (source: XSignalSourceDedupeInput, canonicalHandle: string): boolean =>
  source.handle.trim().toLowerCase() === canonicalHandle

const compareCanonicalCandidates = <T extends XSignalSourceDedupeInput>(
  left: T,
  right: T,
  canonicalHandle: string
): number => {
  const leftScores = [
    left.externalId ? 1 : 0,
    hasProfileData(left) ? 1 : 0,
    left.enabled === true ? 1 : 0,
    isStoredAsCanonical(left, canonicalHandle) ? 1 : 0,
    timestamp(left.updatedAt),
    timestamp(left.createdAt),
    left.priority ?? 0,
  ]
  const rightScores = [
    right.externalId ? 1 : 0,
    hasProfileData(right) ? 1 : 0,
    right.enabled === true ? 1 : 0,
    isStoredAsCanonical(right, canonicalHandle) ? 1 : 0,
    timestamp(right.updatedAt),
    timestamp(right.createdAt),
    right.priority ?? 0,
  ]

  for (let i = 0; i < leftScores.length; i += 1) {
    const diff = (leftScores[i] ?? 0) - (rightScores[i] ?? 0)
    if (diff !== 0) return diff
  }
  return right.id - left.id
}

export const getCanonicalXHandle = (handle: string): string | null => {
  const normalized = normalizeXHandle(handle)
  return normalized.ok ? normalized.handle : null
}

export const chooseCanonicalXSignalSource = <T extends XSignalSourceDedupeInput>(
  sources: T[],
  canonicalHandle: string
): T => {
  const first = sources[0]
  if (!first) throw new Error('chooseCanonicalXSignalSource requires at least one source')
  return sources
    .slice()
    .sort((a, b) => compareCanonicalCandidates(b, a, canonicalHandle))[0] as T
}

const duplicateReason = (
  duplicate: XSignalSourceDedupeInput,
  kept: XSignalSourceDedupeInput
): string => {
  if (kept.externalId && !duplicate.externalId) return 'kept_has_external_id'
  if (hasProfileData(kept) && !hasProfileData(duplicate)) return 'kept_has_profile_metadata'
  if (kept.enabled === true && duplicate.enabled !== true) return 'kept_enabled'
  return 'same_canonical_handle'
}

export const dedupeXSignalSources = <T extends XSignalSourceDedupeInput>(
  sources: T[]
): XDedupeResult<T> => {
  const groups = new Map<string, T[]>()
  const invalidSources: XInvalidSourceReport[] = []
  const passThrough: T[] = []

  for (const source of sources) {
    const normalized = normalizeXHandle(source.handle)
    if (!normalized.ok) {
      invalidSources.push({
        sourceId: source.id,
        rawHandle: source.handle,
        reason: normalized.reason,
      })
      passThrough.push(source)
      continue
    }
    const existing = groups.get(normalized.handle) ?? []
    existing.push(source)
    groups.set(normalized.handle, existing)
  }

  const keptSources: T[] = []
  const dedupedSources: XDedupedSourceReport[] = []
  for (const [canonicalHandle, group] of groups) {
    const kept = chooseCanonicalXSignalSource(group, canonicalHandle)
    keptSources.push(kept)
    for (const duplicate of group) {
      if (duplicate.id === kept.id) continue
      dedupedSources.push({
        duplicateId: duplicate.id,
        keptId: kept.id,
        rawHandle: duplicate.handle,
        canonicalHandle,
        reason: duplicateReason(duplicate, kept),
      })
    }
  }

  return {
    sources: [...keptSources, ...passThrough],
    dedupedSourcesCount: dedupedSources.length,
    dedupedSources,
    invalidSources,
  }
}

export const mergeTags = (sources: XSignalSourceDedupeInput[]): string[] =>
  Array.from(new Set(sources.flatMap(source => source.tags ?? []))).sort()

export const __testing = {
  hasProfileData,
  isStoredAsCanonical,
  timestamp,
}
