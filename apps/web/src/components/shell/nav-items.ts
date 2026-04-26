export type NavGroup = 'cockpit' | 'ia' | 'signaux'

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
  icon: string
  color: string
}

export const NAV_GROUPS: NavGroupMeta[] = [
  {
    id: 'cockpit',
    label: 'Cockpit personnel',
    shortLabel: 'Cockpit',
    icon: '◈',
    color: 'text-primary/55',
  },
  {
    id: 'ia',
    label: 'IA',
    shortLabel: 'IA',
    icon: '▣',
    color: 'text-aurora/70',
  },
  {
    id: 'signaux',
    label: 'Données & signaux',
    shortLabel: 'Signaux',
    icon: '≈',
    color: 'text-accent-2/55',
  },
]

export const NAV_ITEMS: NavItem[] = [
  // ── Cockpit personnel ──────────────────────────────────────
  {
    to: '/',
    label: 'Cockpit',
    icon: '◈',
    description: "Vue d'ensemble du jour",
    group: 'cockpit',
    mobilePriority: 1,
  },
  {
    to: '/depenses',
    label: 'Dépenses',
    icon: '↔',
    description: 'Suivi quotidien des transactions',
    group: 'cockpit',
    mobilePriority: 2,
  },
  {
    to: '/patrimoine',
    label: 'Patrimoine',
    icon: '◊',
    description: 'Actifs et soldes',
    group: 'cockpit',
    mobilePriority: 3,
  },
  {
    to: '/investissements',
    label: 'Invest.',
    icon: '△',
    description: 'Positions et portfolio',
    group: 'cockpit',
  },
  {
    to: '/objectifs',
    label: 'Objectifs',
    icon: '◎',
    description: 'Cap et progression',
    group: 'cockpit',
  },
  {
    to: '/integrations',
    label: 'Intégrations',
    icon: '⊞',
    description: 'Connexions bancaires et sync',
    group: 'cockpit',
  },
  {
    to: '/sante',
    label: 'Santé',
    icon: '♡',
    description: "Diagnostics de l'app",
    group: 'cockpit',
  },
  {
    to: '/parametres',
    label: 'Paramètres',
    icon: '⚙',
    description: 'Configuration',
    group: 'cockpit',
  },

  // ── IA ─────────────────────────────────────────────────────
  {
    to: '/ia',
    label: 'Advisor',
    icon: '▣',
    description: 'Brief, recommandations et chat IA',
    group: 'ia',
    mobilePriority: 4,
  },
  {
    to: '/ia/chat',
    label: 'Chat finance',
    icon: '◬',
    description: 'Conversation financière avec contexte',
    group: 'ia',
  },
  {
    to: '/ia/memoire',
    label: 'Mémoire',
    icon: '[#]',
    description: 'Graphe de connaissances et contexte',
    group: 'ia',
  },
  {
    to: '/ia/couts',
    label: 'Coûts IA',
    icon: '⊘',
    description: 'Tokens, modèles et budget',
    group: 'ia',
    adminOnly: true,
  },

  // ── Données & signaux ──────────────────────────────────────
  {
    to: '/signaux',
    label: 'Actualités',
    icon: '⊟',
    description: 'Flux macro-financier et news',
    group: 'signaux',
  },
  {
    to: '/signaux/marches',
    label: 'Marchés',
    icon: '≈',
    description: 'Contexte macro et signaux',
    group: 'signaux',
  },
  {
    to: '/signaux/social',
    label: 'Social',
    icon: '⊕',
    description: 'Comptes X, Bluesky et imports manuels',
    group: 'signaux',
  },
  {
    to: '/signaux/sources',
    label: 'Sources',
    icon: '⊡',
    description: 'Fraîcheur et qualité des données',
    group: 'signaux',
    adminOnly: true,
  },
]

/** Items for mobile bottom tabs, sorted by priority. */
export const getMobileTabItems = (): NavItem[] =>
  NAV_ITEMS.filter(i => i.mobilePriority !== undefined).sort(
    (a, b) => (a.mobilePriority ?? 99) - (b.mobilePriority ?? 99)
  )

/** Items for mobile drawer (everything not in bottom tabs). */
export const getMobileDrawerItems = (): NavItem[] =>
  NAV_ITEMS.filter(i => i.mobilePriority === undefined)

/** Items for a specific group. */
export const getGroupItems = (group: NavGroup): NavItem[] =>
  NAV_ITEMS.filter(i => i.group === group)
