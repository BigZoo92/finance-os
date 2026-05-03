/**
 * Search-param helpers for the Advisor 3D knowledge graph route.
 *
 * Supports a tight V1 surface: `?node=<id>` and `?lens=<id>`. Anything
 * else is intentionally ignored. Pure functions so they can be unit-
 * tested without spinning up the router.
 */
import {
  ADVISOR_GRAPH_LENSES,
  type AdvisorGraphLensId,
} from './advisor-graph-lenses'

export interface AdvisorGraphSearch {
  node: string | undefined
  lens: AdvisorGraphLensId | undefined
}

const VALID_LENS_IDS = new Set<AdvisorGraphLensId>(
  ADVISOR_GRAPH_LENSES.map(l => l.id)
)

const MAX_NODE_ID_LENGTH = 200
const NODE_ID_PATTERN = /^[A-Za-z0-9_:.\-/]+$/

export const isValidLensId = (raw: unknown): raw is AdvisorGraphLensId =>
  typeof raw === 'string' && VALID_LENS_IDS.has(raw as AdvisorGraphLensId)

export const isValidNodeId = (raw: unknown): raw is string =>
  typeof raw === 'string' &&
  raw.length > 0 &&
  raw.length <= MAX_NODE_ID_LENGTH &&
  NODE_ID_PATTERN.test(raw)

/**
 * Strict TanStack-Router-friendly validator. Returns an object with
 * only the validated fields; invalid values become `undefined`.
 */
export const validateAdvisorGraphSearch = (raw: Record<string, unknown>): AdvisorGraphSearch => {
  const node = isValidNodeId(raw.node) ? raw.node : undefined
  const lens = isValidLensId(raw.lens) ? raw.lens : undefined
  const out: AdvisorGraphSearch = {
    node: node ?? undefined,
    lens: lens ?? undefined,
  }
  return out
}

/**
 * Compute a stable next search object given the current state. Returns
 * `null` when nothing actually changes (so callers can skip a navigate
 * call and avoid history loops).
 */
export const diffSearch = (
  current: AdvisorGraphSearch,
  next: { nodeId: string | null; lensId: AdvisorGraphLensId }
): AdvisorGraphSearch | null => {
  const nextNode = next.nodeId && isValidNodeId(next.nodeId) ? next.nodeId : undefined
  const nextLens = next.lensId
  if (current.node === nextNode && current.lens === nextLens) return null
  return { node: nextNode, lens: nextLens }
}
