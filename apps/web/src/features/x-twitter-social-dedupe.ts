import type { SignalSource } from './signals-api'

export type SocialDuplicateSource = {
  duplicateId: number
  keptId: number
  rawHandle: string
  canonicalHandle: string
  reason: string
}

export const normalizeXHandleForUi = (input: string): string => {
  let raw = input.trim()
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw)
      const host = url.hostname.toLowerCase().replace(/^www\./, '')
      if (
        host === 'x.com' ||
        host === 'twitter.com' ||
        host === 'mobile.twitter.com' ||
        host === 'm.twitter.com'
      ) {
        raw = url.pathname.split('/').filter(Boolean)[0] ?? raw
      }
    } catch {
      // Fallback to best-effort display cleanup below.
    }
  }
  return raw.trim().replace(/^@+/, '').replace(/\/+$/, '').toLowerCase()
}

const hasProfile = (source: SignalSource): boolean =>
  source.profileImageUrl != null ||
  source.profileCachedAt != null ||
  (source.profileMetadata != null && Object.keys(source.profileMetadata).length > 0)

const time = (value: string | null | undefined): number =>
  value ? new Date(value).getTime() || 0 : 0

const chooseVisibleSource = (sources: SignalSource[], canonicalHandle: string): SignalSource =>
  sources
    .slice()
    .sort((a, b) => {
      const scoresA = [
        a.externalId ? 1 : 0,
        hasProfile(a) ? 1 : 0,
        a.enabled ? 1 : 0,
        a.handle.trim().toLowerCase() === canonicalHandle ? 1 : 0,
        time(a.updatedAt),
        time(a.createdAt),
        a.priority,
      ]
      const scoresB = [
        b.externalId ? 1 : 0,
        hasProfile(b) ? 1 : 0,
        b.enabled ? 1 : 0,
        b.handle.trim().toLowerCase() === canonicalHandle ? 1 : 0,
        time(b.updatedAt),
        time(b.createdAt),
        b.priority,
      ]
      for (let i = 0; i < scoresA.length; i += 1) {
        const diff = (scoresB[i] ?? 0) - (scoresA[i] ?? 0)
        if (diff !== 0) return diff
      }
      return a.id - b.id
    })[0] as SignalSource

export const dedupeSignalSourcesForDisplay = (
  sources: SignalSource[]
): { sources: SignalSource[]; duplicates: SocialDuplicateSource[] } => {
  const nonX = sources.filter(source => source.provider !== 'x_twitter')
  const groups = new Map<string, SignalSource[]>()
  for (const source of sources.filter(source => source.provider === 'x_twitter')) {
    const canonical = normalizeXHandleForUi(source.handle)
    const existing = groups.get(canonical) ?? []
    existing.push(source)
    groups.set(canonical, existing)
  }

  const visible: SignalSource[] = []
  const duplicates: SocialDuplicateSource[] = []
  for (const [canonicalHandle, group] of groups) {
    const kept = chooseVisibleSource(group, canonicalHandle)
    visible.push(kept)
    for (const duplicate of group) {
      if (duplicate.id === kept.id) continue
      duplicates.push({
        duplicateId: duplicate.id,
        keptId: kept.id,
        rawHandle: duplicate.handle,
        canonicalHandle,
        reason: kept.externalId && !duplicate.externalId ? 'kept_has_external_id' : 'same_canonical_handle',
      })
    }
  }

  return {
    sources: [...visible, ...nonX].sort(
      (a, b) => b.priority - a.priority || a.displayName.localeCompare(b.displayName)
    ),
    duplicates,
  }
}
