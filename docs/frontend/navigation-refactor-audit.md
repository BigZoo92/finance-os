# Navigation Refactor Audit — Prompt 3

> Date: 2026-04-26

## Current State

### Route inventory (11 app routes)
| Route | Label | Section | Role |
|-------|-------|---------|------|
| `/` | Cockpit | main | KPIs, patrimoine trend, top expenses, goals |
| `/depenses` | Dépenses | main | Transactions, budgets |
| `/actualites` | Actualités | main | News + AI Advisor combined |
| `/memoire` | Mémoire | main | Knowledge graph, hybrid search |
| `/patrimoine` | Patrimoine | main | Assets, balances |
| `/objectifs` | Objectifs | main | Financial goals CRUD |
| `/investissements` | Invest. | main | Investment positions |
| `/marches` | Marchés | main | Markets, macro, watchlist |
| `/integrations` | Intégrations | system | Powens connections, sync |
| `/sante` | Santé | system | System health diagnostics |
| `/parametres` | Paramètres | system | Settings, notifications |

### Problems identified

1. **Actualités page is overloaded**: combines news feed AND full AI Advisor panel (~1000-line component). The AI Advisor is crammed as a sub-surface of a "news" page — it should be its own first-class area.

2. **News/markets too prominent**: Actualités (#3) and Marchés (#8) are in the main nav alongside personal finance pages. For a single-user personal cockpit, they're context/signal providers, not primary destinations.

3. **Flat nav hierarchy**: 8 main + 3 system = 11 items with no grouping. Desktop sidebar is a long list. No conceptual grouping between personal finance, AI, and external data.

4. **Mobile nav mismatch**: Bottom tabs show Cockpit, Dépenses, Actualités, Mémoire — Actualités is a news page, not personal finance. Mémoire is a knowledge-graph debug surface, not a daily-use page. Better mobile tabs: Cockpit, Dépenses, Patrimoine, IA.

5. **AI Advisor buried**: To access financial advisor, user must go to "Actualités" — confusing name and framing. No dedicated recommendations page. Chat is small within a large panel.

6. **Mémoire disconnected**: Knowledge graph page is main-section level but is really an AI infrastructure surface. Should be under IA section.

7. **No AI cost surface**: Token spend, model usage, and cost data exists (advisor spend query) but has no dedicated view.

8. **No revenue/charges page**: The prompt asks for "Revenus & charges" but no dedicated route exists. This can be addressed in the nav structure.

9. **Command palette uses old 2-group model**: "Finances" and "Système" — needs 3-group update.

### What works well
- Shell layout pattern is clean (sidebar + topbar + mobile nav)
- Motion system is premium and reduced-motion aware
- Demo/admin dual-path is solid throughout
- SSR loaders + TanStack Query patterns are consistent
- Page headers use TextPressure for visual identity
- Panel/KpiTile/StatusDot surface system is reusable
- BrandMark and ASCII art give personality

## Proposed Changes

### New 3-section navigation

**1. Cockpit personnel**
- `/` — Cockpit (unchanged hero)
- `/depenses` — Dépenses
- `/patrimoine` — Patrimoine
- `/investissements` — Investissements
- `/objectifs` — Objectifs
- `/integrations` — Intégrations bancaires
- `/sante` — Santé de l'app
- `/parametres` — Paramètres

**2. IA**
- `/ia` — Advisor (overview + daily brief + recommendations)
- `/ia/chat` — Chat finance (dedicated chat surface)
- `/ia/memoire` — Mémoire & connaissances (moved from /memoire)
- `/ia/couts` — Coûts IA / tokens
- `/ia/evals` — Évals & confiance

**3. Données & signaux**
- `/signaux/actualites` — Actualités (news feed only, advisor removed)
- `/signaux/marches` — Marchés & macro
- `/signaux/sources` — Sources API & fraîcheur

### Route migration strategy
- `/actualites` → redirect to `/ia` (AI Advisor is the main content)
- `/memoire` → redirect to `/ia/memoire`
- `/marches` → redirect to `/signaux/marches`
- News feed content from actualites → `/signaux/actualites`
- AI Advisor content from actualites → `/ia`

### Mobile primary tabs (5 items)
1. Cockpit (/)
2. Dépenses (/depenses)
3. Patrimoine (/patrimoine)
4. IA (/ia)
5. Plus (drawer)

### Desktop sidebar
- 3 groups with headers: "Cockpit personnel", "IA", "Données & signaux"
- Collapsed mode: groups separated by dividers, no headers
- System items (Intégrations, Santé, Paramètres) at bottom of first group
