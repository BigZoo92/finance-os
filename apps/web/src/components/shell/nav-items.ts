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
  NewspaperPixelIcon,
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

export type NavGroup = 'cockpit' | 'ia' | 'expert'

export type NavItem = {
  to: string
  label: string
  /**
   * Pixel Icon by default; Phosphor only where the pixel set has no clear metaphor.
   * See the `finance-os-icon-system` skill before changing one.
   */
  icon: IconComponent
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
  /** Short label for the collapsed sidebar divider. */
  shortLabel: string
  description: string
  color: string
}

export const NAV_GROUPS: NavGroupMeta[] = [
  {
    id: 'cockpit',
    label: 'Cockpit',
    shortLabel: 'Cockpit',
    description: 'Usage quotidien, decisions et suivi personnel.',
    color: 'text-primary/55',
  },
  {
    id: 'ia',
    label: 'Advisor IA',
    shortLabel: 'IA',
    description: 'Conseils, questions et memoire comprehensible.',
    color: 'text-aurora/70',
  },
  {
    id: 'expert',
    label: 'Ops & Admin',
    shortLabel: 'Ops',
    description: 'Diagnostics, ingestion et couts.',
    color: 'text-accent-2/55',
  },
]

export const NAV_ITEMS: NavItem[] = [
  {
    to: '/',
    label: "Vue d'ensemble",
    icon: HomePixelIcon,
    description: 'Resume actionnable de ta situation',
    group: 'cockpit',
    mobilePriority: 1,
  },
  {
    to: '/depenses',
    label: 'Depenses & revenus',
    icon: ReceiptPixelIcon,
    description: 'Transactions, budgets et cashflow',
    group: 'cockpit',
    mobilePriority: 2,
  },
  {
    to: '/patrimoine',
    label: 'Patrimoine',
    icon: BankPixelIcon,
    description: 'Actifs, soldes et trajectoire',
    group: 'cockpit',
    mobilePriority: 3,
  },
  {
    to: '/investissements',
    label: 'Investissements',
    icon: TrendingPixelIcon,
    description: 'Positions et portefeuille lisible',
    group: 'cockpit',
  },
  {
    to: '/objectifs',
    label: 'Objectifs',
    icon: FlagPixelIcon,
    description: 'Cibles, epargne et progression',
    group: 'cockpit',
  },
  {
    to: '/ia',
    label: 'Vue IA',
    icon: RobotPixelIcon,
    description: 'Brief, conseils et recommandations',
    group: 'ia',
    mobilePriority: 4,
  },
  {
    to: '/ia/strategie-investissement',
    label: "Plan d'action investissement",
    icon: CheckListPixelIcon,
    description: 'Strategie, comptes et recommandations tracees',
    group: 'ia',
  },
  {
    to: '/ia/chat',
    label: 'Chat',
    icon: CommentPixelIcon,
    description: "Questions a l'Advisor sur tes finances",
    group: 'ia',
  },
  {
    to: '/ia/memoire',
    label: 'Memoire',
    icon: NotebookPixelIcon,
    description: 'Contexte, sources et connaissances IA',
    group: 'ia',
  },
  {
    to: '/ia/memoire/graph',
    label: 'Carte 3D',
    icon: ChartNetworkPixelIcon,
    description: 'Carte memoire 3D, concepts et relations',
    group: 'ia',
  },
  {
    to: '/signaux',
    label: 'Signaux',
    icon: NewspaperPixelIcon,
    description: "Donnees brutes resumees pour l'IA",
    group: 'expert',
    adminOnly: true,
  },
  {
    to: '/signaux/marches',
    label: 'Marches',
    icon: ChartLinePixelIcon,
    description: 'Macro, watchlist et signaux marche',
    group: 'expert',
    adminOnly: true,
  },
  {
    to: '/signaux/social',
    label: 'Social Intelligence',
    icon: HashtagPixelIcon,
    description: 'X, comptes suivis, lookup et sync J-1',
    group: 'expert',
    adminOnly: true,
  },
  {
    to: '/ia/trading-lab',
    label: 'Trading Lab',
    icon: FlaskIcon,
    description: 'Recherche papier et backtests, sans execution',
    group: 'expert',
    adminOnly: true,
  },
  {
    to: '/ia/couts',
    label: 'Couts',
    icon: CoinsPixelIcon,
    description: 'Tokens, modeles, providers et abonnements',
    group: 'expert',
    adminOnly: true,
  },
  {
    to: '/integrations',
    label: 'Integrations',
    icon: LinkPixelIcon,
    description: 'Connexions, sync et diagnostics provider',
    group: 'expert',
    adminOnly: true,
  },
  {
    to: '/sante',
    label: 'Sante admin',
    icon: HeartbeatIcon,
    description: 'Etat systeme et pipelines de donnees',
    group: 'expert',
    adminOnly: true,
  },
  {
    to: '/orchestration',
    label: 'Orchestration',
    icon: RefreshPixelIcon,
    description: 'Daily Intelligence Run et relances manuelles',
    group: 'expert',
    adminOnly: true,
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
