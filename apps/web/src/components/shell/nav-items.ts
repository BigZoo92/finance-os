import {
  BankPixelIcon,
  ChartLinePixelIcon,
  ChartNetworkPixelIcon,
  CheckListPixelIcon,
  CoinsPixelIcon,
  CommentPixelIcon,
  FlagPixelIcon,
  HashtagPixelIcon,
  HomePixelIcon,
  LinkPixelIcon,
  NotebookPixelIcon,
  ReceiptPixelIcon,
  RefreshPixelIcon,
  RobotPixelIcon,
  TrendingPixelIcon,
} from '@finance-os/ui/icons/pixel'
import type { IconComponent } from '@finance-os/ui/icons/types'
import { FlaskIcon } from '@phosphor-icons/react/dist/csr/Flask'
import { HeartbeatIcon } from '@phosphor-icons/react/dist/csr/Heartbeat'
import type { AuthViewState } from '@/features/auth-view-state'

/**
 * Canonical Command Pixel navigation registry.
 *
 * Desktop: Cockpit, Argent (dropdown), IA (dropdown), Radar, Ops (dropdown,
 * Admin only), per `.design/command-pixel-v1/ROUTE_MAP.md`.
 * Mobile: Cockpit, Dépenses, Patrimoine, Advisor, Plus.
 *
 * Nav visibility is NOT a security boundary: pages keep their own
 * demo/admin handling.
 */

export type NavLink = {
  to: string
  label: string
  /**
   * Pixel Icon by default; Phosphor only where the pixel set has no clear
   * metaphor. See the `finance-os-icon-system` skill before changing one.
   */
  icon: IconComponent
  /** Very short functional description (dropdowns, drawer, palette). */
  description: string
  /** Admin-only links are hidden in demo/pending nav. */
  adminOnly?: boolean
  /** Palette search keywords. */
  keywords?: string
}

export type NavGroupId = 'argent' | 'ia' | 'ops'

export type NavEntry =
  | { kind: 'link'; link: NavLink }
  | {
      kind: 'group'
      id: NavGroupId
      label: string
      adminOnly?: boolean
      items: NavLink[]
    }

const COCKPIT: NavLink = {
  to: '/',
  label: 'Cockpit',
  icon: HomePixelIcon,
  description: 'Vue quotidienne',
  keywords: 'accueil home dashboard vue ensemble quotidien cockpit',
}

const DEPENSES: NavLink = {
  to: '/depenses',
  label: 'Dépenses',
  icon: ReceiptPixelIcon,
  description: "Comprendre où part l'argent",
  keywords: 'transactions budgets cashflow revenus depenses',
}

const PATRIMOINE: NavLink = {
  to: '/patrimoine',
  label: 'Patrimoine',
  icon: BankPixelIcon,
  description: 'Vue globale des actifs',
  keywords: 'actifs soldes assets wealth comptes patrimoine',
}

const INVESTISSEMENTS: NavLink = {
  to: '/investissements',
  label: 'Investissements',
  icon: TrendingPixelIcon,
  description: 'Positions et performance',
  keywords: 'positions portfolio bourse invest ibkr binance',
}

const OBJECTIFS: NavLink = {
  to: '/objectifs',
  label: 'Objectifs',
  icon: FlagPixelIcon,
  description: 'Suivre les objectifs financiers',
  keywords: 'goals épargne cibles progression objectifs',
}

const ADVISOR: NavLink = {
  to: '/ia',
  label: 'Advisor',
  icon: RobotPixelIcon,
  description: 'Plan et recommandations',
  keywords: 'advisor ia brief recommandations conseils plan investissement',
}

const CHAT: NavLink = {
  to: '/ia/chat',
  label: 'Chat',
  icon: CommentPixelIcon,
  description: 'Questions et réponses',
  keywords: 'chat conversation question reponse dialogue',
}

const MEMOIRE: NavLink = {
  to: '/ia/memoire',
  label: 'Mémoire',
  icon: NotebookPixelIcon,
  description: 'Concepts et relations',
  keywords: 'memoire connaissances contexte graphe',
}

const RADAR: NavLink = {
  to: '/signaux',
  label: 'Radar',
  icon: ChartLinePixelIcon,
  description: 'Marchés et signaux',
  keywords: 'radar signaux marches macro watchlist news actualites',
}

const ORCHESTRATION: NavLink = {
  to: '/orchestration',
  label: 'Orchestration',
  icon: RefreshPixelIcon,
  description: 'Jobs et relances',
  adminOnly: true,
  keywords: 'refresh daily intelligence cron jobs ops orchestration sync admin',
}

const COUTS: NavLink = {
  to: '/ia/couts',
  label: 'Coûts',
  icon: CoinsPixelIcon,
  description: "Coûts d'exploitation",
  adminOnly: true,
  keywords: 'tokens couts budget modeles llm usage abonnements admin',
}

const INTEGRATIONS: NavLink = {
  to: '/integrations',
  label: 'Intégrations',
  icon: LinkPixelIcon,
  description: 'Connexions et synchronisation',
  adminOnly: true,
  keywords: 'powens sync banque connexion provider ibkr binance admin',
}

const SANTE: NavLink = {
  to: '/sante',
  label: 'Santé',
  icon: HeartbeatIcon,
  description: 'État du système',
  adminOnly: true,
  keywords: 'health diagnostics systeme fraicheur valorisation admin',
}

const SOCIAL_INTELLIGENCE: NavLink = {
  to: '/signaux/social',
  label: 'Social Intelligence',
  icon: HashtagPixelIcon,
  description: 'Sources et comptes suivis',
  adminOnly: true,
  keywords: 'social intelligence x twitter bluesky comptes lookup handle sync admin',
}

/** Primary desktop navigation, in canonical order. */
export const NAV_ENTRIES: NavEntry[] = [
  { kind: 'link', link: COCKPIT },
  {
    kind: 'group',
    id: 'argent',
    label: 'Argent',
    items: [DEPENSES, PATRIMOINE, INVESTISSEMENTS, OBJECTIFS],
  },
  {
    kind: 'group',
    id: 'ia',
    label: 'IA',
    items: [ADVISOR, CHAT, MEMOIRE],
  },
  { kind: 'link', link: RADAR },
  {
    kind: 'group',
    id: 'ops',
    label: 'Ops',
    adminOnly: true,
    items: [ORCHESTRATION, COUTS, INTEGRATIONS, SANTE],
  },
]

/**
 * Live routes outside the canonical primary navigation. Reachable through
 * the command palette (and the mobile drawer for Social Intelligence)
 * until their page phases decide their final home.
 */
export const SECONDARY_LINKS: NavLink[] = [
  SOCIAL_INTELLIGENCE,
  {
    to: '/signaux/marches',
    label: 'Marchés',
    icon: ChartLinePixelIcon,
    description: 'Macro et watchlist',
    adminOnly: true,
    keywords: 'macro watchlist regime taux inflation fred eodhd marches bourse admin',
  },
  {
    to: '/ia/memoire/graph',
    label: 'Mémoire 3D',
    icon: ChartNetworkPixelIcon,
    description: 'Carte des concepts',
    keywords: 'carte memoire 3d graphe concepts relations',
  },
  {
    to: '/ia/strategie-investissement',
    label: "Plan d'action investissement",
    icon: CheckListPixelIcon,
    description: 'Stratégie et allocations',
    keywords: 'investissement strategie allocation pea plan action advisor',
  },
  {
    to: '/ia/trading-lab',
    label: 'Trading Lab',
    icon: FlaskIcon,
    description: 'Recherche papier',
    adminOnly: true,
    keywords: 'trading lab papier paper backtest recherche strategies admin',
  },
]

/** Mobile bottom tabs, canonical order. The fifth tab is Plus (drawer). */
export const MOBILE_TABS: NavLink[] = [COCKPIT, DEPENSES, PATRIMOINE, ADVISOR]

export type MobileDrawerSection = {
  id: string
  label: string
  items: NavLink[]
}

/** Mobile Plus drawer sections, per the canonical route map handoff. */
export const MOBILE_DRAWER_SECTIONS: MobileDrawerSection[] = [
  { id: 'argent', label: 'Argent', items: [INVESTISSEMENTS, OBJECTIFS] },
  { id: 'ia', label: 'IA', items: [CHAT, MEMOIRE] },
  { id: 'radar', label: 'Radar', items: [RADAR, SOCIAL_INTELLIGENCE] },
  { id: 'ops', label: 'Ops', items: [ORCHESTRATION, COUTS, INTEGRATIONS, SANTE] },
]

export const isNavLinkVisible = (link: NavLink, authViewState: AuthViewState): boolean =>
  !link.adminOnly || authViewState === 'admin'

export const isNavEntryVisible = (entry: NavEntry, authViewState: AuthViewState): boolean => {
  if (entry.kind === 'link') return isNavLinkVisible(entry.link, authViewState)
  if (entry.adminOnly && authViewState !== 'admin') return false
  return entry.items.some(item => isNavLinkVisible(item, authViewState))
}

/** Visible primary entries, with group items filtered per auth state. */
export const getVisibleNavEntries = (authViewState: AuthViewState): NavEntry[] =>
  NAV_ENTRIES.filter(entry => isNavEntryVisible(entry, authViewState)).map(entry =>
    entry.kind === 'group'
      ? { ...entry, items: entry.items.filter(item => isNavLinkVisible(item, authViewState)) }
      : entry
  )

/** Visible mobile drawer sections for the Plus drawer. */
export const getVisibleDrawerSections = (
  authViewState: AuthViewState
): MobileDrawerSection[] =>
  MOBILE_DRAWER_SECTIONS.map(section => ({
    ...section,
    items: section.items.filter(item => isNavLinkVisible(item, authViewState)),
  })).filter(section => section.items.length > 0)

/** Every visible destination (primary + secondary) for the palette. */
export const getPaletteLinks = (authViewState: AuthViewState): NavLink[] => {
  const primary = NAV_ENTRIES.flatMap(entry =>
    entry.kind === 'link' ? [entry.link] : entry.items
  )
  return [...primary, ...SECONDARY_LINKS].filter(link =>
    isNavLinkVisible(link, authViewState)
  )
}

/**
 * Canonical active-route matcher.
 *
 * `/` and `/ia` are exact (Advisor must not activate for `/ia/chat` or
 * `/ia/couts`); every other destination matches itself and its children.
 */
export const isRouteActive = (pathname: string, to: string): boolean => {
  if (to === '/' || to === '/ia') return pathname === to
  return pathname === to || pathname.startsWith(`${to}/`)
}

/** A group is active when one of its (visible or not) items is active. */
export const isGroupActive = (
  pathname: string,
  entry: Extract<NavEntry, { kind: 'group' }>
): boolean => entry.items.some(item => isRouteActive(pathname, item.to))
