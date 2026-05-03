import { describe, expect, it } from 'vitest'
import {
  diffSearch,
  isValidLensId,
  isValidNodeId,
  validateAdvisorGraphSearch,
} from './advisor-graph-search-params'

describe('isValidLensId', () => {
  it('accepts the 7 known lens ids', () => {
    for (const id of ['atlas', 'decision', 'personal', 'market', 'risk', 'knowledge', 'sources']) {
      expect(isValidLensId(id)).toBe(true)
    }
  })

  it('rejects unknown / non-string values', () => {
    expect(isValidLensId('trading')).toBe(false)
    expect(isValidLensId('')).toBe(false)
    expect(isValidLensId(undefined)).toBe(false)
    expect(isValidLensId(42)).toBe(false)
  })
})

describe('isValidNodeId', () => {
  it('accepts namespaced ids and example: prefix', () => {
    expect(isValidNodeId('snapshot:me')).toBe(true)
    expect(isValidNodeId('example:concept:cash_drag')).toBe(true)
    expect(isValidNodeId('a-b/c.d_e')).toBe(true)
  })

  it('rejects empty / overly long / invalid characters', () => {
    expect(isValidNodeId('')).toBe(false)
    expect(isValidNodeId('x'.repeat(500))).toBe(false)
    expect(isValidNodeId('with space')).toBe(false)
    expect(isValidNodeId('<script>')).toBe(false)
    expect(isValidNodeId(undefined)).toBe(false)
  })
})

describe('validateAdvisorGraphSearch', () => {
  it('keeps valid node + lens', () => {
    const r = validateAdvisorGraphSearch({ node: 'snapshot:me', lens: 'risk' })
    expect(r.node).toBe('snapshot:me')
    expect(r.lens).toBe('risk')
  })

  it('drops invalid values quietly', () => {
    const r = validateAdvisorGraphSearch({ node: 'with space', lens: 'trading' })
    expect(r.node).toBeUndefined()
    expect(r.lens).toBeUndefined()
  })

  it('ignores unknown extra params', () => {
    const r = validateAdvisorGraphSearch({ node: 'a', lens: 'atlas', extra: 'evil' } as Record<string, unknown>)
    expect(r.node).toBe('a')
    expect(r.lens).toBe('atlas')
    expect((r as unknown as Record<string, unknown>).extra).toBeUndefined()
  })
})

describe('diffSearch', () => {
  it('returns null when nothing changes', () => {
    const r = diffSearch(
      { node: 'a', lens: 'atlas' },
      { nodeId: 'a', lensId: 'atlas' }
    )
    expect(r).toBeNull()
  })

  it('proposes the new node when it changes', () => {
    const r = diffSearch(
      { node: 'a', lens: 'atlas' },
      { nodeId: 'b', lensId: 'atlas' }
    )
    expect(r).toEqual({ node: 'b', lens: 'atlas' })
  })

  it('clears node when set to null', () => {
    const r = diffSearch(
      { node: 'a', lens: 'atlas' },
      { nodeId: null, lensId: 'atlas' }
    )
    expect(r).toEqual({ node: undefined, lens: 'atlas' })
  })
})
