export type NavItem = {
  to: string
  label: string
  icon: string
  description: string
  section?: 'main' | 'system'
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Cockpit', icon: '◈', description: "Vue d'ensemble du jour", section: 'main' },
  { to: '/depenses', label: 'Dépenses', icon: '↔', description: 'Suivi quotidien des transactions', section: 'main' },
  { to: '/actualites', label: 'Actualités', icon: '▣', description: 'Briefing marché et conseils IA', section: 'main' },
  { to: '/patrimoine', label: 'Patrimoine', icon: '◊', description: 'Actifs et soldes', section: 'main' },
  { to: '/objectifs', label: 'Objectifs', icon: '◎', description: 'Cap et progression', section: 'main' },
  { to: '/investissements', label: 'Invest.', icon: '△', description: 'Positions et portfolio', section: 'main' },
  { to: '/marches', label: 'Marchés', icon: '≈', description: 'Contexte macro et signaux', section: 'main' },
  { to: '/integrations', label: 'Intégrations', icon: '⊞', description: 'Powens et sync', section: 'system' },
  { to: '/sante', label: 'Santé', icon: '♡', description: 'Diagnostics système', section: 'system' },
  { to: '/parametres', label: 'Paramètres', icon: '⚙', description: 'Configuration', section: 'system' },
]
