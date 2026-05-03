import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  buildPinStorageKey,
  clearPersistedPins,
  readPersistedPins,
  reconcilePinsAgainstGraph,
  writePersistedPins,
} from './advisor-graph-pins'

class MemoryStorage implements Storage {
  private store = new Map<string, string>()
  get length(): number {
    return this.store.size
  }
  clear(): void {
    this.store.clear()
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null
  }
  removeItem(key: string): void {
    this.store.delete(key)
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
}

const installLocalStorage = (impl: Storage | undefined) => {
  // vitest's `node` env doesn't ship `window`. We stub a minimal global.
  const g = globalThis as unknown as { window?: { localStorage?: Storage } }
  g.window = impl ? { localStorage: impl } : {}
}

describe('buildPinStorageKey', () => {
  it('namespaces pins per (authMode, origin, scope) and version', () => {
    const a = buildPinStorageKey({ authMode: 'admin', origin: 'real', scope: 'overview' })
    const b = buildPinStorageKey({ authMode: 'admin', origin: 'mixed', scope: 'overview' })
    const c = buildPinStorageKey({ authMode: 'demo', origin: 'demo', scope: 'overview' })
    expect(a).not.toBe(b)
    expect(a).not.toBe(c)
    expect(a.startsWith('finance-os:advisor-graph:pinned-nodes:')).toBe(true)
    // version segment present
    expect(a.split(':')[3]).toBe('v1')
  })
})

describe('readPersistedPins / writePersistedPins', () => {
  let storage: MemoryStorage
  beforeEach(() => {
    storage = new MemoryStorage()
    installLocalStorage(storage)
  })
  afterEach(() => installLocalStorage(undefined))

  it('round-trips a list of ids', () => {
    const key = 'k'
    writePersistedPins(key, ['a', 'b', 'c'])
    expect(readPersistedPins(key)).toEqual(['a', 'b', 'c'])
  })

  it('removes the key when writing an empty list', () => {
    const key = 'k'
    writePersistedPins(key, ['a'])
    writePersistedPins(key, [])
    expect(storage.getItem(key)).toBeNull()
  })

  it('returns [] when storage is missing (SSR / private mode)', () => {
    installLocalStorage(undefined)
    expect(readPersistedPins('k')).toEqual([])
  })

  it('returns [] when JSON is malformed', () => {
    storage.setItem('k', '{not json')
    expect(readPersistedPins('k')).toEqual([])
  })

  it('drops non-string entries and clamps over-long ids', () => {
    const longId = 'x'.repeat(500)
    storage.setItem('k', JSON.stringify(['ok', 42, '', null, longId]))
    expect(readPersistedPins('k')).toEqual(['ok'])
  })

  it('clears via clearPersistedPins', () => {
    writePersistedPins('k', ['a'])
    clearPersistedPins('k')
    expect(readPersistedPins('k')).toEqual([])
  })

  it('does not crash when localStorage throws on getItem', () => {
    const broken = {
      length: 0,
      clear: () => undefined,
      getItem: () => {
        throw new Error('SecurityError')
      },
      key: () => null,
      removeItem: () => undefined,
      setItem: () => undefined,
    } satisfies Storage
    installLocalStorage(broken)
    expect(readPersistedPins('k')).toEqual([])
  })
})

describe('reconcilePinsAgainstGraph', () => {
  it('keeps known ids, drops unknowns', () => {
    const known = new Set(['a', 'b'])
    const result = reconcilePinsAgainstGraph(['a', 'b', 'c'], known)
    expect(result.kept).toEqual(['a', 'b'])
    expect(result.dropped).toEqual(['c'])
  })

  it('returns empty kept/dropped on empty input', () => {
    const r = reconcilePinsAgainstGraph([], new Set())
    expect(r.kept).toEqual([])
    expect(r.dropped).toEqual([])
  })

  it('preserves the original order of kept ids', () => {
    const known = new Set(['c', 'a'])
    const r = reconcilePinsAgainstGraph(['a', 'b', 'c'], known)
    expect(r.kept).toEqual(['a', 'c'])
  })
})
