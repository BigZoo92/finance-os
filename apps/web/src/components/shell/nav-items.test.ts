import { describe, expect, it } from 'vitest'
import {
  getPaletteLinks,
  getVisibleDrawerSections,
  getVisibleNavEntries,
  isGroupActive,
  isRouteActive,
  MOBILE_TABS,
  NAV_ENTRIES,
  type NavEntry,
} from './nav-items'

const groupOf = (entries: NavEntry[], id: string) =>
  entries.find((e): e is Extract<NavEntry, { kind: 'group' }> => e.kind === 'group' && e.id === id)

describe('canonical nav grouping', () => {
  it('follows the canonical desktop order: Cockpit, Argent, IA, Radar, Ops', () => {
    const shape = NAV_ENTRIES.map(e => (e.kind === 'link' ? e.link.label : e.label))
    expect(shape).toEqual(['Cockpit', 'Argent', 'IA', 'Radar', 'Ops'])
  })

  it('Argent contains the four canonical destinations', () => {
    const argent = groupOf(NAV_ENTRIES, 'argent')
    expect(argent?.items.map(i => i.label)).toEqual([
      'Dépenses',
      'Patrimoine',
      'Investissements',
      'Objectifs',
    ])
  })

  it('IA contains Advisor, Chat and Mémoire only', () => {
    const ia = groupOf(NAV_ENTRIES, 'ia')
    expect(ia?.items.map(i => i.label)).toEqual(['Advisor', 'Chat', 'Mémoire'])
  })

  it('Ops contains the four admin destinations', () => {
    const ops = groupOf(NAV_ENTRIES, 'ops')
    expect(ops?.adminOnly).toBe(true)
    expect(ops?.items.map(i => i.label)).toEqual([
      'Orchestration',
      'Coûts',
      'Intégrations',
      'Santé',
    ])
  })

  it('uses accented canonical labels without forbidden punctuation', () => {
    const labels = NAV_ENTRIES.flatMap(e =>
      e.kind === 'link' ? [e.link.label, e.link.description] : e.items.flatMap(i => [i.label, i.description])
    )
    for (const label of labels) {
      expect(label).not.toMatch(/[·—;]/)
    }
  })
})

describe('admin gating', () => {
  it('hides Ops in demo mode', () => {
    const entries = getVisibleNavEntries('demo')
    expect(groupOf(entries, 'ops')).toBeUndefined()
  })

  it('hides Ops while auth is pending', () => {
    const entries = getVisibleNavEntries('pending')
    expect(groupOf(entries, 'ops')).toBeUndefined()
  })

  it('shows Ops in admin mode', () => {
    const entries = getVisibleNavEntries('admin')
    expect(groupOf(entries, 'ops')?.items).toHaveLength(4)
  })

  it('keeps Radar visible in demo mode (primary destination)', () => {
    const entries = getVisibleNavEntries('demo')
    expect(entries.some(e => e.kind === 'link' && e.link.label === 'Radar')).toBe(true)
  })

  it('filters admin-only palette destinations in demo mode', () => {
    const demoLabels = getPaletteLinks('demo').map(l => l.label)
    expect(demoLabels).not.toContain('Trading Lab')
    expect(demoLabels).not.toContain('Social Intelligence')
    expect(demoLabels).toContain('Mémoire 3D')
    const adminLabels = getPaletteLinks('admin').map(l => l.label)
    expect(adminLabels).toContain('Trading Lab')
    expect(adminLabels).toContain('Coûts')
  })
})

describe('mobile navigation', () => {
  it('exposes the four canonical tabs (Plus is the fifth)', () => {
    expect(MOBILE_TABS.map(t => t.label)).toEqual([
      'Cockpit',
      'Dépenses',
      'Patrimoine',
      'Advisor',
    ])
  })

  it('drawer hides Ops and Social Intelligence in demo mode', () => {
    const sections = getVisibleDrawerSections('demo')
    expect(sections.map(s => s.id)).toEqual(['argent', 'ia', 'radar'])
    const radar = sections.find(s => s.id === 'radar')
    expect(radar?.items.map(i => i.label)).toEqual(['Radar'])
  })

  it('drawer shows Ops entries in admin mode', () => {
    const sections = getVisibleDrawerSections('admin')
    const ops = sections.find(s => s.id === 'ops')
    expect(ops?.items.map(i => i.label)).toEqual([
      'Orchestration',
      'Coûts',
      'Intégrations',
      'Santé',
    ])
  })
})

describe('active route semantics', () => {
  it('matches the root exactly', () => {
    expect(isRouteActive('/', '/')).toBe(true)
    expect(isRouteActive('/depenses', '/')).toBe(false)
  })

  it('keeps /ia exact so Advisor does not activate for unrelated IA routes', () => {
    expect(isRouteActive('/ia', '/ia')).toBe(true)
    expect(isRouteActive('/ia/chat', '/ia')).toBe(false)
    expect(isRouteActive('/ia/couts', '/ia')).toBe(false)
  })

  it('matches children for normal destinations', () => {
    expect(isRouteActive('/ia/memoire/graph', '/ia/memoire')).toBe(true)
    expect(isRouteActive('/signaux/social', '/signaux')).toBe(true)
    expect(isRouteActive('/depensesx', '/depenses')).toBe(false)
  })

  it('activates the parent group for its children only', () => {
    const argent = groupOf(NAV_ENTRIES, 'argent')
    const ia = groupOf(NAV_ENTRIES, 'ia')
    const ops = groupOf(NAV_ENTRIES, 'ops')
    if (!argent || !ia || !ops) throw new Error('missing canonical groups')

    expect(isGroupActive('/patrimoine', argent)).toBe(true)
    expect(isGroupActive('/ia', ia)).toBe(true)
    expect(isGroupActive('/ia/chat', ia)).toBe(true)
    expect(isGroupActive('/ia/couts', ia)).toBe(false)
    expect(isGroupActive('/ia/couts', ops)).toBe(true)
    expect(isGroupActive('/', argent)).toBe(false)
  })
})
