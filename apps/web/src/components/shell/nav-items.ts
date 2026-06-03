import type { AuthViewState } from '@/features/auth-view-state'

export type NavGroup = 'cockpit' | 'ia' | 'expert'

export type NavItem = {
  to: string
  label: string
  icon: string
  description: string
  group: NavGroup
  /** Items with mobilePriority appear as bottom-bar tabs (lower = more prominent). */
  mobilePriority?: number
  /** Admin-only items are hidden in demo mode nav (page itself still handles demo). */
  adminOnly?: boolean
}

export type NavGroupMeta = {
  id: NavGroup
  label: string
  /** Short label for collapsed sidebar divider tooltips. */
  shortLabel: string
  description: string
  icon: string
  color: string
}

export const NAV_GROUPS: NavGroupMeta[] = [
  {
    id: 'cockpit',
    label: 'Cockpit personnel',
    shortLabel: 'Cockpit',
    description: 'Usage quotidien, decisions et suivi personnel.',
    icon: 'O',
    color: 'text-primary/55',
  },
  {
    id: 'ia',
    label: 'Advisor IA',
    shortLabel: 'IA',
    description: 'Conseils, questions et memoire comprehensible.',
    icon: '#',
    color: 'text-aurora/70',
  },
  {
    id: 'expert',
    label: 'Ops & Admin',
    shortLabel: 'Ops',
    description: 'Diagnostics, ingestion, couts et sources avancees.',
    icon: '<>',
    color: 'text-accent-2/55',
  },
]

export const NAV_ITEMS: NavItem[] = [
  {
    to: '/',
    label: "Vue d'ensemble",
    icon: 'O',
    description: 'Resume actionnable de ta situation',
    group: 'cockpit',
    mobilePriority: 1,
  },
  {
    to: '/depenses',
    label: 'Depenses & revenus',
    icon: '<>',
    description: 'Transactions, budgets et cashflow',
    group: 'cockpit',
    mobilePriority: 2,
  },
  {
    to: '/patrimoine',
    label: 'Patrimoine',
    icon: '<>',
    description: 'Actifs, soldes et trajectoire',
    group: 'cockpit',
    mobilePriority: 3,
  },
  {
    to: '/investissements',
    label: 'Investissements',
    icon: '/\\',
    description: 'Positions et portefeuille lisible',
    group: 'cockpit',
  },
  {
    to: '/fiscalite',
    label: 'Fiscalite',
    icon: 'TAX',
    description: 'Dossier preparatoire a verifier',
    group: 'cockpit',
    adminOnly: true,
  },
  {
    to: '/objectifs',
    label: 'Objectifs',
    icon: '()',
    description: 'Cibles, epargne et progression',
    group: 'cockpit',
  },
  {
    to: '/ia',
    label: 'Vue IA',
    icon: '#',
    description: 'Brief, conseils et recommandations',
    group: 'ia',
    mobilePriority: 4,
  },
  {
    to: '/ia/strategie-investissement',
    label: "Plan d'action investissement",
    icon: '/\\',
    description: 'Strategie, comptes et recommandations tracees',
    group: 'ia',
  },
  {
    to: '/ia/chat',
    label: 'Chat',
    icon: '[]',
    description: "Questions a l'Advisor sur tes finances",
    group: 'ia',
  },
  {
    to: '/ia/memoire',
    label: 'Memoire',
    icon: '[#]',
    description: 'Contexte, sources et connaissances IA',
    group: 'ia',
  },
  {
    to: '/ia/memoire/graph',
    label: 'Carte 3D',
    icon: '3D',
    description: 'Carte memoire 3D, concepts et relations',
    group: 'ia',
  },
  {
    to: '/signaux',
    label: 'Signaux',
    icon: 'S',
    description: "Donnees brutes resumees pour l'IA",
    group: 'expert',
    adminOnly: true,
  },
  {
    to: '/signaux/marches',
    label: 'Marches',
    icon: 'M',
    description: 'Macro, watchlist et signaux marche',
    group: 'expert',
    adminOnly: true,
  },
  {
    to: '/signaux/social',
    label: 'Social Intelligence',
    icon: 'X',
    description: 'X, comptes suivis, lookup et sync J-1',
    group: 'expert',
    adminOnly: true,
  },
  {
    to: '/signaux/sources',
    label: 'Sources',
    icon: '*',
    description: 'Fraicheur, provenance et qualite',
    group: 'expert',
    adminOnly: true,
  },
  {
    to: '/signaux/free-firehose',
    label: 'Free Firehose',
    icon: '>>',
    description: 'Fetch manuel: GDELT, HN, SEC, FRED, ECB',
    group: 'expert',
    adminOnly: true,
  },
  {
    to: '/ia/trading-lab',
    label: 'Trading Lab',
    icon: 'TL',
    description: 'Recherche papier et backtests, sans execution',
    group: 'expert',
    adminOnly: true,
  },
  {
    to: '/ia/couts',
    label: 'Couts',
    icon: '$',
    description: 'Tokens, modeles, providers et abonnements',
    group: 'expert',
    adminOnly: true,
  },
  {
    to: '/integrations',
    label: 'Integrations',
    icon: '+',
    description: 'Connexions, sync et diagnostics provider',
    group: 'expert',
    adminOnly: true,
  },
  {
    to: '/sante',
    label: 'Sante admin',
    icon: 'OK',
    description: 'Etat systeme et pipelines de donnees',
    group: 'expert',
    adminOnly: true,
  },
  {
    to: '/orchestration',
    label: 'Orchestration',
    icon: '<>',
    description: 'Daily Intelligence Run et relances manuelles',
    group: 'expert',
    adminOnly: true,
  },
  {
    to: '/ops-env-diagnostics',
    label: 'Env diagnostics',
    icon: 'ENV',
    description: 'Flags, secrets attendus et leaks par service',
    group: 'expert',
    adminOnly: true,
  },
  {
    to: '/parametres',
    label: 'Parametres',
    icon: '..',
    description: 'Notifications, exports et configuration',
    group: 'expert',
  },
]

export const isNavItemVisible = (item: NavItem, authViewState: AuthViewState): boolean =>
  !item.adminOnly || authViewState === 'admin'

export const getVisibleNavItems = (authViewState: AuthViewState): NavItem[] =>
  NAV_ITEMS.filter(item => isNavItemVisible(item, authViewState))

/** Items for mobile bottom tabs, sorted by priority. */
export const getMobileTabItems = (authViewState: AuthViewState): NavItem[] =>
  getVisibleNavItems(authViewState)
    .filter(i => i.mobilePriority !== undefined)
    .sort((a, b) => (a.mobilePriority ?? 99) - (b.mobilePriority ?? 99))

/** Items for mobile drawer (everything not in bottom tabs). */
export const getMobileDrawerItems = (authViewState: AuthViewState): NavItem[] =>
  getVisibleNavItems(authViewState).filter(i => i.mobilePriority === undefined)

/** Items for a specific group. */
export const getGroupItems = (group: NavGroup, authViewState: AuthViewState): NavItem[] =>
  getVisibleNavItems(authViewState).filter(i => i.group === group)
