export type NavItem = {
  to: string
  label: string
  icon: string
  description: string
  section?: 'main' | 'system'
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Cockpit', icon: '◈', description: "Vue d'ensemble", section: 'main' },
  { to: '/depenses', label: 'Dépenses', icon: '↔', description: 'Transactions et budgets', section: 'main' },
  { to: '/patrimoine', label: 'Patrimoine', icon: '◊', description: 'Actifs et soldes', section: 'main' },
  { to: '/investissements', label: 'Invest.', icon: '△', description: 'Positions et portfolio', section: 'main' },
  { to: '/marches', label: 'Marchés', icon: '≈', description: 'Marchés & macro', section: 'main' },
  { to: '/objectifs', label: 'Objectifs', icon: '◎', description: 'Objectifs financiers', section: 'main' },
  { to: '/actualites', label: 'Actualités', icon: '▣', description: 'News et conseils IA', section: 'main' },
  { to: '/integrations', label: 'Intégrations', icon: '⊞', description: 'Powens et sync', section: 'system' },
  { to: '/sante', label: 'Santé', icon: '♡', description: 'Diagnostics système', section: 'system' },
  { to: '/parametres', label: 'Paramètres', icon: '⚙', description: 'Configuration', section: 'system' },
]
