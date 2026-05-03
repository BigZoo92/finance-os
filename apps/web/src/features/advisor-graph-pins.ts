/**
 * Persistent pins for the Advisor 3D knowledge graph.
 *
 * Pins survive reload and are scoped per (authMode, origin, scope) so
 * the demo set never contaminates the admin set, and switching scope
 * doesn't carry over pins that no longer exist.
 *
 * SSR-safe: every storage access is guarded against `window === undefined`
 * and any thrown SecurityError (private browsing, disabled storage).
 */

const STORAGE_VERSION = 'v1'
const STORAGE_NAMESPACE = 'finance-os:advisor-graph:pinned-nodes'
const MAX_PINS = 64
const MAX_ID_LENGTH = 200

export type AdvisorGraphPinScope = 'demo' | 'admin' | 'unknown'
export type AdvisorGraphPinOrigin = 'demo' | 'real' | 'mixed' | 'empty'

export const buildPinStorageKey = (parts: {
  authMode: AdvisorGraphPinScope
  origin: AdvisorGraphPinOrigin
  scope: string
}): string =>
  `${STORAGE_NAMESPACE}:${STORAGE_VERSION}:${parts.authMode}:${parts.origin}:${parts.scope}`

const safeGetStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/**
 * Read the persisted pin set. Returns an empty array on:
 *   - SSR / no window
 *   - localStorage unavailable (private browsing, disabled, quota exceeded)
 *   - missing key
 *   - malformed JSON
 *   - non-array payload
 *   - any item that is not a non-empty string
 */
export const readPersistedPins = (storageKey: string): string[] => {
  const storage = safeGetStorage()
  if (!storage) return []
  try {
    const raw = storage.getItem(storageKey)
    if (raw === null) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const cleaned: string[] = []
    for (const item of parsed) {
      if (typeof item === 'string' && item.length > 0 && item.length <= MAX_ID_LENGTH) {
        cleaned.push(item)
      }
    }
    return cleaned.slice(0, MAX_PINS)
  } catch {
    return []
  }
}

export const writePersistedPins = (storageKey: string, ids: ReadonlyArray<string>): void => {
  const storage = safeGetStorage()
  if (!storage) return
  try {
    const cleaned = Array.from(new Set(ids))
      .filter(id => typeof id === 'string' && id.length > 0 && id.length <= MAX_ID_LENGTH)
      .slice(0, MAX_PINS)
    if (cleaned.length === 0) {
      storage.removeItem(storageKey)
      return
    }
    storage.setItem(storageKey, JSON.stringify(cleaned))
  } catch {
    // ignore quota / serialization errors — pins are best-effort.
  }
}

export const clearPersistedPins = (storageKey: string): void => {
  const storage = safeGetStorage()
  if (!storage) return
  try {
    storage.removeItem(storageKey)
  } catch {
    // ignore
  }
}

/**
 * Filter persisted pins down to the ids that actually exist in the
 * current graph. Pure function — useful as a sanity step on mount and
 * on graph reloads.
 */
export const reconcilePinsAgainstGraph = (
  persisted: ReadonlyArray<string>,
  knownIds: ReadonlySet<string>
): { kept: string[]; dropped: string[] } => {
  const kept: string[] = []
  const dropped: string[] = []
  for (const id of persisted) {
    if (knownIds.has(id)) kept.push(id)
    else dropped.push(id)
  }
  return { kept, dropped }
}
