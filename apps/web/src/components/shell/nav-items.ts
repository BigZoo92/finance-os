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
    description: 'Ton argent au quotidien, sans le bruit expert.',
    icon: '◈',
    color: 'text-primary/55',
  },
  {
    id: 'ia',
    label: 'Advisor IA',
    shortLabel: 'IA',
    description: 'Conseils, questions et mémoire compréhensibles.',
    icon: '□',
    color: 'text-aurora/70',
  },
  {
    id: 'expert',
    label: 'Intelligence & Admin',
    shortLabel: 'Expert',
    description: 'Données brutes, ingestion, diagnostics et recherche.',
    icon: '≋',
    color: 'text-accent-2/55',
  },
]

export const NAV_ITEMS: NavItem[] = [
  // Cockpit personnel
  {
    to: '/',
    label: "Vue d'ensemble",
    icon: '◈',
    description: 'Résumé actionnable de ta situation',
    group: 'cockpit',
    mobilePriority: 1,
  },
  {
    to: '/depenses',
    label: 'Dépenses & revenus',
    icon: '↔',
    description: 'Transactions, budgets et cashflow',
    group: 'cockpit',
    mobilePriority: 2,
  },
  {
    to: '/patrimoine',
    label: 'Patrimoine',
    icon: '◇',
    description: 'Actifs, soldes et trajectoire',
    group: 'cockpit',
    mobilePriority: 3,
  },
  {
    to: '/investissements',
    label: 'Investissements',
    icon: '△',
    description: 'Positions et portefeuille lisible',
    group: 'cockpit',
  },
  {
    to: '/objectifs',
    label: 'Objectifs',
    icon: '◎',
    description: 'Cibles, épargne et progression',
    group: 'cockpit',
  },

  // Advisor IA
  {
    to: '/ia',
    label: 'Vue IA',
    icon: '□',
    description: 'Brief, conseils et recommandations',
    group: 'ia',
    mobilePriority: 4,
  },
  {
    to: '/ia/chat',
    label: 'Chat',
    icon: '▱',
    description: "Questions à l'Advisor sur tes finances",
    group: 'ia',
  },
  {
    to: '/ia/memoire',
    label: 'Mémoire',
    icon: '[#]',
    description: 'Contexte, sources et connaissances IA',
    group: 'ia',
  },
  {
    to: '/ia/memoire/graph',
    label: 'Carte 3D',
    icon: '◴',
    description: 'Carte mémoire 3D, concepts et relations',
    group: 'ia',
  },

  // Intelligence & Admin
  {
    to: '/signaux',
    label: 'Signaux',
    icon: '⊟',
    description: "Données brutes résumées pour l'IA",
    group: 'expert',
  },
  {
    to: '/signaux/marches',
    label: 'Marchés',
    icon: '≋',
    description: 'Macro, watchlist et signaux marché',
    group: 'expert',
  },
  {
    to: '/signaux/social',
    label: 'Social',
    icon: '⊕',
    description: 'Comptes surveillés et imports manuels',
    group: 'expert',
  },
  {
    to: '/signaux/sources',
    label: 'Sources',
    icon: '⚡',
    description: 'Fraîcheur, provenance et qualité',
    group: 'expert',
    adminOnly: true,
  },
  {
    to: '/ia/trading-lab',
    label: 'Trading Lab',
    icon: '⟐',
    description: 'Recherche papier et backtests, sans exécution',
    group: 'expert',
  },
  {
    to: '/ia/couts',
    label: 'Coûts IA',
    icon: '⊘',
    description: 'Tokens, modèles et budget technique',
    group: 'expert',
    adminOnly: true,
  },
  {
    to: '/integrations',
    label: 'Intégrations',
    icon: '⊞',
    description: 'Connexions, sync et diagnostics provider',
    group: 'expert',
  },
  {
    to: '/sante',
    label: 'Santé',
    icon: '♡',
    description: "État système et pipelines de données",
    group: 'expert',
  },
  {
    to: '/parametres',
    label: 'Paramètres',
    icon: '⚙',
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
