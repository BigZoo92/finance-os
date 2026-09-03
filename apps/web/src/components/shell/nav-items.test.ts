import { describe, expect, it } from 'vitest'
import {
  getPaletteLinks,
  getVisibleDrawerSections,
  getVisibleNavEntries,
  isGroupActive,
  isNavLinkActive,
  isRouteActive,
  MOBILE_TABS,
  NAV_ENTRIES,
  type NavEntry,
} from './nav-items'

const groupOf = (entries: NavEntry[], id: string) =>
  entries.find((e): e is Extract<NavEntry, { kind: 'group' }> => e.kind === 'group' && e.id === id)

const linkOf = (entries: NavEntry[], label: string) =>
  entries.find(
    (e): e is Extract<NavEntry, { kind: 'link' }> => e.kind === 'link' && e.link.label === label
  )

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

  it('Radar points to the canonical route and carries Social Intelligence as its related screen', () => {
    const radar = linkOf(NAV_ENTRIES, 'Radar')
    expect(radar?.link.to).toBe('/radar')
    expect(radar?.link.adminOnly).toBeUndefined()
    expect(radar?.related?.map(item => item.to)).toEqual(['/social-intelligence'])
    expect(radar?.related?.[0]?.adminOnly).toBeUndefined()
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
      e.kind === 'link'
        ? [
            e.link.label,
            e.link.description,
            ...(e.related ?? []).flatMap(i => [i.label, i.description]),
          ]
        : e.items.flatMap(i => [i.label, i.description])
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

  it('exposes Radar and Social Intelligence to normal users and keeps admin-only pages out of demo', () => {
    const demoLinks = getPaletteLinks('demo')
    const demoLabels = demoLinks.map(l => l.label)
    expect(demoLabels).toContain('Radar')
    expect(demoLabels).toContain('Social Intelligence')
    expect(demoLabels).not.toContain('Trading Lab')
    expect(demoLabels).not.toContain('Coûts')
    expect(demoLinks.filter(link => link.to === '/ia/memoire')).toHaveLength(1)
    expect(demoLinks.some(link => link.to.startsWith('/signaux'))).toBe(false)
    const adminLabels = getPaletteLinks('admin').map(l => l.label)
    expect(adminLabels).toContain('Trading Lab')
    expect(adminLabels).toContain('Coûts')
    expect(adminLabels.filter(label => label === 'Social Intelligence')).toHaveLength(1)
  })
})

describe('mobile navigation', () => {
  it('exposes the four canonical tabs (Plus is the fifth)', () => {
    expect(MOBILE_TABS.map(t => t.label)).toEqual(['Cockpit', 'Dépenses', 'Patrimoine', 'Advisor'])
  })

  it('drawer offers Radar and Social Intelligence in demo mode and hides Ops', () => {
    const sections = getVisibleDrawerSections('demo')
    expect(sections.map(s => s.id)).toEqual(['argent', 'ia', 'radar'])
    const radar = sections.find(s => s.id === 'radar')
    expect(radar?.items.map(i => i.label)).toEqual(['Radar', 'Social Intelligence'])
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
    expect(isRouteActive('/ia/memoire', '/ia/memoire')).toBe(true)
    expect(isRouteActive('/ia/memoire/graph', '/ia/memoire')).toBe(true)
    expect(isRouteActive('/radar', '/radar')).toBe(true)
    expect(isRouteActive('/depensesx', '/depenses')).toBe(false)
  })

  it('keeps the Radar link active on the Social Intelligence screen', () => {
    const radar = linkOf(NAV_ENTRIES, 'Radar')
    if (!radar) throw new Error('missing Radar link')
    expect(isNavLinkActive('/radar', radar.link)).toBe(true)
    expect(isNavLinkActive('/social-intelligence', radar.link)).toBe(true)
    expect(isNavLinkActive('/ia/chat', radar.link)).toBe(false)
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
