/**
 * Social Intelligence view model.
 *
 * Maps followed signal sources to the source library: identity first
 * (avatar, name, handle, short bio), then tags, platform and a light
 * human status. Backend enums, metrics, provider diagnostics and pipeline
 * vocabulary never reach the gallery.
 */
import type { SignalItem, SignalSource, SignalSourceGroup } from '@/features/signals-api'
import {
  dedupeSignalSourcesForDisplay,
  normalizeXHandleForUi,
} from '@/features/x-twitter-social-dedupe'

export type SocialPlatform = 'x' | 'bluesky' | 'manual' | 'other'
export type SocialStatusKind = 'active' | 'paused' | 'attention'
export type SocialGroup = SignalSourceGroup
export type SocialStatusFilter = 'active' | 'paused'
export type AvatarTint = 'primary' | 'teal' | 'warm' | 'neutral'

export const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  x: 'X',
  bluesky: 'Bluesky',
  manual: 'Import manuel',
  other: 'Autre',
}

/** Two glyphs at most: rendered in the 20px framed platform tile. */
export const PLATFORM_GLYPH: Record<SocialPlatform, string> = {
  x: 'X',
  bluesky: 'BS',
  manual: 'M',
  other: 'A',
}

export const GROUP_LABEL: Record<SocialGroup, string> = {
  finance: 'Finance',
  ai_tech: 'IA et Tech',
}

export const STATUS_PRESENTATION: Record<
  SocialStatusKind,
  { label: string; tone: 'positive' | 'neutral' | 'attention' }
> = {
  active: { label: 'Actif', tone: 'positive' },
  paused: { label: 'En pause', tone: 'neutral' },
  attention: { label: 'À vérifier', tone: 'attention' },
}

const SOCIAL_PROVIDERS: ReadonlySet<string> = new Set(['x_twitter', 'bluesky'])

export type SourceCardModel = {
  id: number
  name: string
  /** Without the leading @. */
  handle: string
  initials: string
  avatarUrl: string | null
  avatarTint: AvatarTint
  bio: string | null
  tags: string[]
  platform: SocialPlatform
  group: SocialGroup
  status: SocialStatusKind
  enabled: boolean
  url: string | null
  lastFetchedAt: string | null
  /** Search haystack, accent and case insensitive. */
  searchText: string
}

export const toPlatform = (provider: string): SocialPlatform => {
  switch (provider) {
    case 'x_twitter':
      return 'x'
    case 'bluesky':
      return 'bluesky'
    case 'manual_import':
      return 'manual'
    default:
      return 'other'
  }
}

export const PROVIDER_FOR_PLATFORM: Record<Exclude<SocialPlatform, 'other'>, string> = {
  x: 'x_twitter',
  bluesky: 'bluesky',
  manual: 'manual_import',
}

const foldText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

export const toInitials = (name: string, fallback: string): string => {
  const words = name
    .replace(/[_.-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  const letters = words
    .slice(0, 2)
    .map(word => word[0] ?? '')
    .join('')
  const source = letters.length > 0 ? letters : fallback.slice(0, 2)
  return source.toUpperCase()
}

const TINTS: AvatarTint[] = ['primary', 'neutral', 'teal', 'warm']

/** Stable decorative tint from the handle so the gallery stays calm across reloads. */
export const avatarTintFor = (handle: string): AvatarTint => {
  let hash = 0
  for (const char of handle) hash = (hash * 31 + char.charCodeAt(0)) % 997
  return TINTS[hash % TINTS.length] ?? 'neutral'
}

const toHandle = (source: SignalSource): string => {
  if (source.provider === 'x_twitter') {
    return normalizeXHandleForUi(source.profileMetadata?.username ?? source.handle)
  }
  return source.handle.trim().replace(/^@+/, '')
}

const toStatus = (source: SignalSource): SocialStatusKind => {
  if (!source.enabled) return 'paused'
  if (source.lastError) return 'attention'
  if (source.provider === 'x_twitter' && source.verificationStatus === 'unresolved') {
    return 'attention'
  }
  return 'active'
}

export const toSourceCard = (source: SignalSource): SourceCardModel => {
  const profile = source.profileMetadata ?? null
  const handle = toHandle(source)
  const name = profile?.name?.trim() || source.displayName.trim() || handle
  const bio = profile?.description?.trim() || null
  const tags = source.tags.map(tag => tag.trim()).filter(Boolean)
  return {
    id: source.id,
    name,
    handle,
    initials: toInitials(name, handle),
    avatarUrl: source.profileImageUrl ?? null,
    avatarTint: avatarTintFor(handle),
    bio,
    tags,
    platform: toPlatform(source.provider),
    group: source.group,
    status: toStatus(source),
    enabled: source.enabled,
    url: source.url,
    lastFetchedAt: source.lastFetchedAt,
    searchText: foldText([name, handle, ...tags].join(' ')),
  }
}

/** Gallery order: the backend priority, then the display name. */
export const buildSourceCards = (sources: SignalSource[]): SourceCardModel[] =>
  dedupeSignalSourcesForDisplay(sources).sources.map(toSourceCard)

export type SocialFilters = {
  q: string
  platform: SocialPlatform | null
  tag: string | null
  status: SocialStatusFilter | null
  group: SocialGroup | null
}

export const EMPTY_SOCIAL_FILTERS: SocialFilters = {
  q: '',
  platform: null,
  tag: null,
  status: null,
  group: null,
}

export const countActiveFilters = (filters: SocialFilters): number =>
  [filters.platform, filters.tag, filters.status, filters.group].filter(value => value !== null)
    .length

export const filterSourceCards = (
  cards: SourceCardModel[],
  filters: SocialFilters
): SourceCardModel[] => {
  const query = foldText(filters.q)
  const tag = filters.tag ? foldText(filters.tag) : null
  return cards.filter(card => {
    if (filters.platform && card.platform !== filters.platform) return false
    if (filters.group && card.group !== filters.group) return false
    if (filters.status === 'active' && card.status === 'paused') return false
    if (filters.status === 'paused' && card.status !== 'paused') return false
    if (tag && !card.tags.some(item => foldText(item) === tag)) return false
    if (query && !card.searchText.includes(query)) return false
    return true
  })
}

export type SocialFacets = {
  platforms: SocialPlatform[]
  tags: string[]
  groups: SocialGroup[]
}

const MAX_TAG_FACETS = 12

/** Filter options come only from the sources actually present. */
export const buildSocialFacets = (cards: SourceCardModel[]): SocialFacets => {
  const platforms = new Set<SocialPlatform>()
  const groups = new Set<SocialGroup>()
  const tagCounts = new Map<string, { label: string; count: number }>()
  for (const card of cards) {
    platforms.add(card.platform)
    groups.add(card.group)
    for (const tag of card.tags) {
      const key = foldText(tag)
      const existing = tagCounts.get(key)
      if (existing) existing.count += 1
      else tagCounts.set(key, { label: tag, count: 1 })
    }
  }
  const platformOrder: SocialPlatform[] = ['x', 'bluesky', 'manual', 'other']
  const groupOrder: SocialGroup[] = ['finance', 'ai_tech']
  return {
    platforms: platformOrder.filter(platform => platforms.has(platform)),
    tags: [...tagCounts.values()]
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
      .slice(0, MAX_TAG_FACETS)
      .map(entry => entry.label),
    groups: groupOrder.filter(group => groups.has(group)),
  }
}

const normalizeAuthor = (author: string): string => author.trim().replace(/^@+/, '').toLowerCase()

/** Persisted items attributed to this source. Only real matches count. */
export const countRelatedSignals = (card: SourceCardModel, items: SignalItem[]): number => {
  if (card.platform !== 'x' && card.platform !== 'bluesky') return 0
  const handle = card.handle.toLowerCase()
  return items.filter(
    item =>
      SOCIAL_PROVIDERS.has(item.sourceProvider) &&
      item.author !== null &&
      normalizeAuthor(item.author) === handle
  ).length
}

// ---------------------------------------------------------------------------
// Route search params (human slugs, lenient parsing)
// ---------------------------------------------------------------------------

export type SocialSearch = {
  q?: string
  platform?: SocialPlatform
  tag?: string
  status?: SocialStatusFilter
  group?: 'finance' | 'ia-tech'
  selected?: number
}

const PLATFORM_SLUGS: ReadonlyArray<SocialPlatform> = ['x', 'bluesky', 'manual', 'other']
const STATUS_SLUGS: ReadonlyArray<SocialStatusFilter> = ['active', 'paused']

const isOneOf = <T extends string>(value: unknown, options: ReadonlyArray<T>): value is T =>
  typeof value === 'string' && (options as ReadonlyArray<string>).includes(value)

export const parseSocialSearch = (raw: Record<string, unknown>): SocialSearch => {
  const search: SocialSearch = {}
  if (typeof raw.q === 'string' && raw.q.trim().length > 0) search.q = raw.q.slice(0, 80)
  if (isOneOf(raw.platform, PLATFORM_SLUGS)) search.platform = raw.platform
  if (typeof raw.tag === 'string' && raw.tag.trim().length > 0) search.tag = raw.tag.slice(0, 60)
  if (isOneOf(raw.status, STATUS_SLUGS)) search.status = raw.status
  if (raw.group === 'finance' || raw.group === 'ia-tech') search.group = raw.group
  const selected = typeof raw.selected === 'string' ? Number(raw.selected) : raw.selected
  if (typeof selected === 'number' && Number.isInteger(selected) && selected > 0) {
    search.selected = selected
  }
  return search
}

export const filtersFromSearch = (search: SocialSearch): SocialFilters => ({
  q: search.q ?? '',
  platform: search.platform ?? null,
  tag: search.tag ?? null,
  status: search.status ?? null,
  group: search.group === 'finance' ? 'finance' : search.group === 'ia-tech' ? 'ai_tech' : null,
})

export const searchFromFilters = (
  filters: SocialFilters,
  selected: number | undefined
): SocialSearch => {
  const search: SocialSearch = {}
  if (filters.q.trim()) search.q = filters.q
  if (filters.platform) search.platform = filters.platform
  if (filters.tag) search.tag = filters.tag
  if (filters.status) search.status = filters.status
  if (filters.group) search.group = filters.group === 'finance' ? 'finance' : 'ia-tech'
  if (selected !== undefined) search.selected = selected
  return search
}

// ---------------------------------------------------------------------------
// Human copy for admin mutations (no HTTP codes, no provider payloads)
// ---------------------------------------------------------------------------

export const describeLookupOutcome = (status: string | undefined, ok: boolean): string => {
  if (ok) return 'Compte vérifié sur X'
  switch (status) {
    case 'unverified_not_found':
      return 'Compte introuvable sur X'
    case 'unverified_invalid_handle':
      return 'Identifiant invalide'
    case 'unverified_rate_limited':
      return 'Vérification temporairement indisponible, réessayez plus tard'
    default:
      return 'Vérification indisponible pour le moment'
  }
}

export const describeCreateFailure = (code: string | undefined): string => {
  switch (code) {
    case 'SIGNAL_SOURCE_DUPLICATE':
      return 'Cette source existe déjà'
    case 'INVALID_HANDLE':
      return 'Identifiant invalide'
    case 'DEMO_MODE_FORBIDDEN':
      return 'Action réservée à la session administrateur'
    default:
      return 'Ajout impossible pour le moment'
  }
}
