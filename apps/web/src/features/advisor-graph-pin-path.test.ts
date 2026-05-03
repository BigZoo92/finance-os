import { describe, expect, it } from 'vitest'
import { pickPinPathEndpoints } from './advisor-graph-pin-path'

const visible = (ids: string[]) => new Set(ids)

describe('pickPinPathEndpoints', () => {
  it('returns null when fewer than 2 pinned ids are visible', () => {
    expect(pickPinPathEndpoints([], visible(['a', 'b']), null)).toBeNull()
    expect(pickPinPathEndpoints(['a'], visible(['a', 'b']), null)).toBeNull()
    // Two pinned but only one visible.
    expect(pickPinPathEndpoints(['a', 'b'], visible(['a']), null)).toBeNull()
  })

  it('uses the selected pinned node as the source when available', () => {
    const r = pickPinPathEndpoints(['a', 'b', 'c'], visible(['a', 'b', 'c']), 'b')
    expect(r).toEqual({ fromId: 'b', toId: 'a' })
  })

  it('falls back to the first two visible pins otherwise', () => {
    const r = pickPinPathEndpoints(['a', 'b', 'c'], visible(['a', 'b', 'c']), null)
    expect(r).toEqual({ fromId: 'a', toId: 'b' })
  })

  it('skips pins that are not visible when picking endpoints', () => {
    const r = pickPinPathEndpoints(['a', 'b', 'c'], visible(['b', 'c']), null)
    expect(r).toEqual({ fromId: 'b', toId: 'c' })
  })

  it('works when selected is the last visible pin', () => {
    const r = pickPinPathEndpoints(['a', 'b'], visible(['a', 'b']), 'b')
    expect(r).toEqual({ fromId: 'b', toId: 'a' })
  })
})
