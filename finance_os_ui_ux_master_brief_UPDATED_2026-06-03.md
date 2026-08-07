# Finance-OS — UI/UX Master Brief

> **Version mise à jour — 2026-06-03**
>
> Ce fichier reprend le master brief original et ajoute les sections **25 à 31** pour refléter l’état réel du chantier après les phases de debug CI/VPS/RUNS/COSTS/MEMORY/CATEGORIZATION/OPS et la nouvelle priorité **ASSET-VALUATION-0**.
>
> En cas de contradiction entre les anciennes sections et les sections **25+**, les sections **25+** font foi.
>
> Statut global : **pas encore maquettes**. La prochaine priorité produit est la **valorisation fiable des actifs**, puis le **nettoyage UI + content map**, puis seulement les **maquettes Claude Design/Stitch**.


## 0. Objectif du chantier
Refondre l’UI/UX et la direction artistique de Finance-OS avec un rendu ultra esthétique, original, créatif, performant, ergonomique et accessible.

L’objectif n’est pas seulement de rendre l’app plus jolie : il faut rendre Finance-OS plus claire, plus agréable, plus crédible, plus rapide, plus accessible, et plus facile à maintenir.

## 1. Règles de collaboration
- Les messages courts du type inspiration, capture, police, couleur, navbar, carte, interaction, etc. sont considérés comme des matériaux à classer.
- Répondre seulement quand l’utilisateur le demande explicitement ou quand une décision structurante doit être validée.
- Chaque inspiration doit être convertie en intention design exploitable, pas seulement conservée comme image.
- Chaque décision doit rester compatible avec performance, accessibilité, ergonomie et maintenabilité.
- Le rapport `FINANCE_OS_UI_UX_REPO_AUDIT.md` est désormais la base de vérité initiale du chantier.

## 2. Base actuelle issue des audits repo
Audit initial reçu le 2026-05-24 : `FINANCE_OS_UI_UX_REPO_AUDIT.md`.
Audit de clarification reçu le 2026-05-24 : `FINANCE_OS_UI_UX_PHASE_0_CLARIFICATION.md`.

### 2.1 Architecture actuelle
- Monorepo pnpm.
- Frontend : `apps/web`, TanStack Start / React 19 / Tailwind v4.
- Backend : `apps/api`, Elysia/Bun.
- Worker : `apps/worker`.
- Services annexes : `knowledge-service`, `quant-service`.
- Packages clés : `ui`, `db`, `ai`, `finance-engine`, `powens`, `external-investments`, `env`, `redis`, `prelude`, `provider-contract`, `provider-runtime`, `config-ts`.
- React Compiler est confirmé actif dans `apps/web/vite.config.ts`.

### 2.2 Produit actuel
Finance-OS est un cockpit financier personnel single-user avec deux chemins stricts :
- demo : fixtures déterministes, usage public/démo ;
- admin : données live, outils avancés, debug, intégrations.

Dual-path demo/admin = invariant non négociable.

### 2.3 Routes et pages
- 35 fichiers de routes détectés.
- 31 pages réelles + 4 stubs/redirects 301.
- Les stubs/redirects sont : `/_app/marches`, `/_app/memoire`, `/_app/actualites`, `/_app/signaux/x-twitter`.
- Les pages réelles authentifiées sous `/_app/` sont donc environ 23, pas 27.

### 2.4 Pages critiques à refondre
- `/_app/` cockpit principal.
- `/_app/depenses`.
- `/_app/patrimoine`.
- `/_app/investissements`.
- `/_app/integrations`.
- `/_app/ia`.
- `/_app/ia/chat`.
- `/_app/ia/strategie-investissement`.
- `/_app/ia/memoire`.
- `/_app/ia/memoire/graph`.
- `/_app/signaux`.
- `/_app/signaux/marches`.
- `/_app/signaux/social`.
- `/_app/sante`.
- `/_app/fiscalite`.
- `/_app/objectifs`.
- `/_app/orchestration`.
- `/_app/parametres`.
- `/login`.

### 2.5 Pages très denses / fichiers à risque
- `/_app/ia/memoire/graph` : environ 1860 LOC.
- `/_app/ia/strategie-investissement` : environ 1216 LOC.
- `/_app/signaux/social` : environ 1206 LOC.
- `/_app/integrations` : environ 1072 LOC.
- `/_app/patrimoine` : environ 1004 LOC.
- `/_app/investissements` : environ 971 LOC.
- `ai-advisor-panel` : environ 1013 LOC.
- `personal-financial-goals-card` : environ 921 LOC.

Ces zones doivent être découpées, pas juste restylées.

### 2.6 Corrections importantes du rapport de clarification
- GSAP est utilisé par plusieurs composants : ne pas le supprimer aveuglément.
- Radix UI est présent en dépendance mais non importé dans le code source : design system encore plus pauvre que prévu côté Dialog/Drawer/Tabs/Tooltip.
- `personal-ux.tsx` n’est pas orphelin : il est utilisé par plusieurs routes clés.
- `dashboard/topbar.tsx` et `dashboard/sidebar-nav.tsx` sont morts.
- Plusieurs composants dashboard morts sont confirmés.
- 8 composants ReactBits morts totalisent environ 2865 LOC.
- Environ 3295 LOC de composants potentiellement morts sont identifiés au total.
- `liquid-ether` est très lourd et utilisé uniquement via le cockpit.
- `pixel-blast` est utilisé sur `/login` et `/_app/sante`, usage santé à challenger.
- `text-pressure` est présent via `PageHeader` sur environ 22 routes, donc très structurant.
- 20 fichiers contiennent des `oklch()` hardcodés inline.
- Le skill `finance-os-ui-cockpit` est bien obsolète : palette amber/gold au lieu de la DA actuelle.

## 3. Diagnostic général
### 3.1 Ce qui fonctionne déjà
- Architecture produit sérieuse.
- Navigation déjà organisée en trois groupes : cockpit personnel, Advisor IA, intelligence/admin.
- Système demo/admin déjà bien pensé.
- Tokens Aurora Pink cohérents.
- Typographies actuelles propres : Inter Variable, JetBrains Mono Variable, Compressa pour hero.
- Motion system existant.
- Documentation frontend déjà riche.
- Infrastructure agentique et skills très avancées.

### 3.2 Ce qui ne fonctionne pas assez
- Beaucoup de pages mélangent trop d’intentions.
- Trop d’informations techniques remontent dans des écrans utilisateur.
- Le design system partagé est trop pauvre.
- Plusieurs composants importants vivent dans `apps/web` au lieu de `packages/ui`.
- Les états loading/empty/error/degraded ne sont pas assez standardisés.
- Les visualisations financières manquent de règles fortes.
- Advisor UX est trop technique à certains endroits.
- Le knowledge graph 3D est spectaculaire mais lourd et peu accessible.
- Certaines dépendances ou composants lourds doivent être audités : Three.js, react-force-graph-3d, reactbits heavy, GSAP.

## 4. À supprimer / réduire
À remplir au fil de la conversation, mais premiers candidats issus des audits :
- Bruit technique dans les pages utilisateur.
- Diagnostics provider visibles par défaut.
- Sync logs et audit trails visibles sans drilldown.
- Termes trop backend : `context-bundle`, `advisor-knowledge`, `fine-tuning-readiness`, `free-firehose`, etc.
- Pages monolithiques à plus de 1000 LOC.
- Effets décoratifs lourds s’ils ne servent pas l’expérience.
- Doublons UI legacy confirmés morts : `components/dashboard/topbar.tsx`, `components/dashboard/sidebar-nav.tsx`.
- Composants dashboard morts confirmés : `portfolio-summary`, `metric-card`, `expenses-list`, `dashboard-health-panel`, `api-status-card`.
- ReactBits morts à valider avant suppression : `dock`, `glass-surface`, `magic-bento`, `pixel-trail`, `pixel-transition`, `shape-blur`, `staggered-menu`, `variable-proximity`.
- `aurora-backdrop.tsx` potentiellement mort.
- Radix UI si confirmé inutilisé et non choisi pour le futur DS.
- Usage `pixel-blast` sur `/_app/sante`, à challenger.
- `liquid-ether` sur cockpit : à garder uniquement si vraie valeur signature, sinon alléger/lazy-load/remplacer.

## 5. À conserver / renforcer
- Dual-path demo/admin.
- Fail-soft UI.
- Aurora Pink comme base actuelle, sauf décision contraire future.
- Tokens OKLCH.
- Séparation rose/violet = identité, emerald/coral/amber = sémantique finance.
- Inter + JetBrains Mono.
- Surfaces canoniques : `KpiTile`, `Panel`, `RangePill`, `PageHeader`, `StatusDot`.
- Navigation en trois familles.
- Motion utile, courte, respectueuse de `prefers-reduced-motion`.
- Advisor comme cockpit explicable, pas boîte noire.
- Knowledge graph comme exploration dérivée, jamais source de vérité métier.

## 6. Inspirations DA
À remplir au fil de la conversation.

Pour chaque inspiration :
- Source ou capture.
- Ce qui plaît.
- Ce qui ne doit pas être copié.
- Traduction Finance-OS.
- Risques UX/accessibilité/performance.

## 7. Typographies
À remplir au fil de la conversation.

Pour chaque police :
- Usage envisagé : logo, titres, chiffres, body, labels, data viz.
- Lisibilité.
- Licence.
- Fallback.
- Impact performance.

## 8. Couleurs et tokens
Base actuelle : Aurora Pink.

### 8.1 Palette actuelle à considérer comme point de départ
- Brand rose magenta.
- Accent violet électrique.
- Background dark midnight plum.
- Light warm pearl.
- Positive emerald.
- Negative coral.
- Warning amber.

### 8.2 À décider
- Conserver Aurora Pink telle quelle.
- Faire Aurora Pink v2 plus mature, moins “rose flashy”.
- Changer complètement de DA, uniquement si les inspirations futures justifient une rupture.

## 9. Architecture d’information cible
Principe central : décision > contexte > détail.

### 9.1 Cockpit principal
Objectif : page quotidienne claire.
- Priorité : KPIs, attention items, résumé Advisor digéré.
- Réduire : détails techniques, trop de cartes empilées.
- Ajouter : hiérarchie plus nette, drilldown, états dégradés propres.

### 9.2 Patrimoine
Objectif : comprendre la situation globale.
- Priorité : total patrimoine, allocation, évolution, anomalies.
- Réduire : tables trop denses visibles directement.
- Ajouter : tabs ou sections `aperçu / détail / historique`.

### 9.3 Investissements
Objectif : comprendre le portefeuille et l’allocation.
- Clarifier la frontière avec `/ia/strategie-investissement`.
- Éviter la redondance entre analyse portefeuille et recommandations Advisor.

### 9.4 Intégrations
Objectif : connecter et surveiller les sources.
- Découper par provider : Powens, IBKR, Binance.
- Masquer diagnostics avancés dans drawer/admin.

### 9.5 Advisor IA
Objectif : rendre les recommandations compréhensibles et crédibles.
- Chaque recommandation doit expliquer : pourquoi maintenant, données utilisées, hypothèses, risques, confiance, sources.
- Toujours distinguer conseil, hypothèse, limite, action utilisateur.

### 9.6 Knowledge graph
Objectif : exploration, pas décision.
- Garder la 3D si elle apporte de l’identité.
- Ajouter une alternative tableau/liste accessible.
- Lazy-load obligatoire.

## 10. Principes UI/UX Finance-OS
- Priorité à la clarté financière et à la confiance.
- Réduction drastique du bruit visuel.
- Une page = une intention principale.
- Données hiérarchisées : décision > contexte > détail.
- Drilldown plutôt qu’empilement.
- Animations utiles, jamais décoratives gratuitement.
- Composants beaux mais sobres quand une décision financière est en jeu.
- Demo/admin visibles mais non polluants.
- Les erreurs et données dégradées doivent être rassurantes, explicables et actionnables.
- L’IA doit être explicable, prudente et contextualisée.

## 11. Performance et accessibilité
### 11.1 Points à respecter
- Core Web Vitals.
- Navigation clavier.
- Focus visible.
- Contrastes.
- Reduced motion.
- États loading/empty/error/degraded non bloquants.
- Skeletons utiles, pas décoratifs.
- Lazy loading pour 3D, graphes et visualisations coûteuses.
- Alternative accessible aux visualisations complexes.

### 11.2 Pages à surveiller
- `/` cockpit.
- `/ia/memoire/graph`.
- `/signaux/marches`.
- `/integrations`.
- `/ia/strategie-investissement`.
- `/login` si PixelBlast reste présent.
- `/_app/sante` si PixelBlast reste présent.
- `/_app/objectifs` si Antigravity reste présent.

### 11.3 Risques perf clarifiés
- `liquid-ether` : 1254 LOC WebGL, usage cockpit unique, import statique à traiter.
- `pixel-blast` : 705 LOC, utilisé login + santé.
- `antigravity` : utilisé sur objectifs.
- `react-force-graph-3d` est déjà lazy/dynamic sur le knowledge graph.
- `lightweight-charts` est déjà importé dynamiquement dans les charts trading-lab.
- GSAP est réellement utilisé, donc pas de suppression aveugle.
- Radix UI semble inutilisé, à confirmer avant suppression ou décision DS.

### 11.4 Baseline à faire ensuite
- Lighthouse / Core Web Vitals sur pages clés.
- Bundle analyzer.
- Axe-core ou équivalent pour a11y.
- Vérification contraste tokens.
- Test clavier/réduced-motion.

## 12. Skills Claude / design / frontend
### 12.1 Skills existants utiles
- `finance-os-ui-cockpit` — utile mais à resynchroniser avec Aurora Pink.
- `finance-os-core-invariants`.
- `finance-os-observability-failsoft`.
- GitNexus impact/refactoring/debugging.
- Impeccable : polish, critique, audit, arrange, typeset, colorize, adapt, harden, visual-qa.
- TanStack skills : start/router/query best practices.
- Performance / Core Web Vitals / web-quality-audit.

### 12.2 Skills à créer ou renforcer
- `data-visualization-finance`.
- `ai-advisor-ux`.
- `admin-debug-ux-separation`.
- `dashboard-information-architecture`.
- `accessibility-reviewer` orienté WCAG/checklist composants.
- `financial-product-ux`.

## 13. Pipeline cible
1. Collecte inspirations + écrans actuels.
2. Analyse du rapport d’audit repo.
3. Phase de clarification technique : lever les `à confirmer`, vérifier composants réellement utilisés, dépendances lourdes, doublons, baseline perf/a11y.
4. Phase de retours utilisateur écran par écran : ce que l’utilisateur n’aime pas, veut supprimer, veut changer, veut ajouter, veut déplacer, veut simplifier ou rendre plus visible.
5. Définition DA et design principles.
6. Définition information architecture page par page.
7. Prompt Claude Design / Stitch pour maquettes.
8. Sélection / critique / itération des maquettes.
9. Prompt Claude Max pour implémentation progressive.
10. QA UI/UX/accessibilité/performance.
11. Documentation finale dans le repo.

## 13.1 Phase retours utilisateur à ne pas oublier
Cette phase vient après la clarification technique et avant toute génération de maquettes.

Pour chaque écran, l’utilisateur pourra fournir :
- ce qui ne lui convient pas actuellement ;
- ce qu’il veut supprimer ;
- ce qu’il veut garder ;
- ce qu’il veut rendre plus visible ;
- ce qu’il veut déplacer ailleurs ;
- ce qu’il veut ajouter ;
- ce qui est trop technique ;
- ce qui manque de clarté ;
- ce qui manque d’émotion, de style ou de finition ;
- les inspirations associées à cet écran.

Ces retours devront être consolidés dans un document de décisions UI/UX avant Claude Design / Stitch.

## 14. Stratégie de refonte recommandée
### Phase 0 — Gel + baseline
- Synchroniser skill `finance-os-ui-cockpit` avec DESIGN.md.
- Mesurer Lighthouse/bundle sur pages clés.
- Auditer GSAP et reactbits heavy.
- Lire/figer docs frontend.

### Phase 1 — Design principles + tokens
- Décider Aurora Pink, Aurora Pink v2 ou nouvelle DA.
- Documenter palette chart.
- Créer règles copywriting/vocabulaire.
- Créer ADR de refonte UI.

### Phase 2 — Shell + navigation
- Nettoyer shell.
- Sécuriser mobile nav.
- Améliorer command palette.
- Garder structure cockpit / Advisor / admin.

### Phase 3 — Design system
- Remonter les composants canoniques dans `packages/ui`.
- Ajouter DataTable, Skeleton, Field, WidgetError, WidgetDegraded, EmptyState, ModeBadge.

### Phase 4 — Cockpit
- Refaire la hiérarchie de la page d’accueil.
- Découper `ai-advisor-panel`.
- Standardiser les cartes.

### Phase 5 — Pages data-heavy
- Patrimoine.
- Investissements.
- Dépenses.
- Intégrations.
- Stratégie investissement.

### Phase 6 — Advisor
- Recommandations explicables.
- Confidence/freshness/source standardisées.
- Challenger visible si pertinent.
- Knowledge graph avec fallback accessible.

### Phase 7 — Admin/debug separation
- Cacher diagnostics dans drawers.
- Renommer concepts techniques.
- Nettoyer pages admin.

### Phase 8 — QA
- A11y.
- Performance.
- Responsive.
- Reduced motion.
- Demo/admin E2E.

### Phase 9 — Documentation
- DESIGN.md.
- docs/frontend.
- ADRs.
- Skills.

## 15. Décisions validées
- Le rapport `FINANCE_OS_UI_UX_REPO_AUDIT.md` devient la base de vérité initiale.
- Le rapport `FINANCE_OS_UI_UX_PHASE_0_CLARIFICATION.md` corrige et précise l’audit initial.
- On ne lance pas directement une refonte visuelle complète : on passe d’abord par architecture d’information + design system + priorisation.
- Le dual-path demo/admin reste non négociable.
- Les futures inspirations seront classées et transformées en décisions exploitables.

## 15.1 Feedback utilisateur — Page cockpit
Source : screenshot cockpit + note utilisateur `note_cockpit.md`.

### Ce qui ne convient pas
- Le hero actuel avec `liquid-ether` ne convient pas.
- Le hero prend trop de place et n’apporte pas de valeur fonctionnelle.
- Le wording actuel est perçu comme trop “IA”, trop artificiel, et ajoute du bruit.
- Les sections “Aujourd’hui / Ta situation en un coup d’œil”, “Prochaines actions”, “Ma trajectoire / Ce qui change sur la période” sont trop verbeuses.
- La synthèse Advisor sur le cockpit est à supprimer dans sa forme actuelle.
- Tous les éléments ReactBits doivent dégager de cette page cockpit.
- Le footer du cockpit est à supprimer.

### À supprimer du cockpit
- Hero visuel grand format.
- `liquid-ether`.
- ReactBits sur la page cockpit.
- Wording type : “Aujourd’hui”, “Ta situation en un coup d’œil”, “Les chiffres utiles maintenant, avec le bruit expert gardé en arrière-plan”.
- Bloc “Prochaines actions”.
- Bloc “Lire l’Advisor / Inspecter les dépenses / Voir le détail du patrimoine”.
- Wording “Ma trajectoire / Ce qui change sur la période / Patrimoine, revenus, dépenses et cashflow réunis dans une lecture simple”.
- Bloc “Synthèse Advisor / Brief quotidien / degraded / recommandations / aide à la décision”.
- Footer cockpit.

### À garder
- La partie “Mes données”, mais avec un wording plus naturel et moins IA.
- Les top dépenses.
- Les objectifs.
- Les données utiles rapidement accessibles.

### À rendre plus visible
- L’argent disponible sur les comptes courants, notamment Fortuneo et Revolut.

### À ajouter / réorganiser
- Une vue claire de ce que l’utilisateur a gagné et perdu.
- Une section “Comptes courants” : Fortuneo, Revolut, total disponible, détail discret par compte.
- Une section “Épargne” : Livret Jeune, Livret A, LDDS, assurance-vie, etc.
- Une section “Investissements” : Binance, Trade Republic, IBKR, avec un rendu fin et intelligent.
- Une section “Objectifs”.
- Une section “Top dépenses”.
- Une section santé/providers/app : indique si les providers et l’app vont bien ; si problème, CTA vers la page de diagnostic détaillée.

### Nouvelle intention cockpit
Le cockpit doit devenir une page de lecture immédiate, pas une page vitrine.
Objectif principal : comprendre en quelques secondes où est l’argent, ce qui a bougé, ce qui mérite attention, et si les données sont fiables.

### Direction d’architecture d’information cockpit cible
Priorité recommandée :
1. Solde disponible / comptes courants.
2. Ce que j’ai gagné / perdu sur la période.
3. Épargne.
4. Investissements.
5. Top dépenses.
6. Objectifs.
7. Santé des providers/app avec CTA si souci.

### Contraintes cockpit
- Pas de hero décoratif.
- Pas de ReactBits sur cette page.
- Pas de wording “IA/corporate”.
- Pas d’Advisor visible par défaut dans le cockpit, ou alors uniquement sous forme d’alerte extrêmement discrète et actionnable si nécessaire.
- La page doit être rapide, claire, ergonomique, accessible et orientée lecture immédiate.

## 15.2 Feedback utilisateur — Page dépenses
Source : screenshot dépenses + note utilisateur `note_depense.md`.

### Ce qui ne convient pas
- Le wording reste trop “IA”, trop verbeux, parfois trop technique.
- La page est globalement meilleure que le cockpit, mais elle doit être recentrée.
- Les sections d’introduction et d’explication ajoutent du bruit.
- La page ne doit pas transformer chaque ligne ou chaque dépense en problème.

### À supprimer de la page dépenses
- Le wording “Cockpit personnel”.
- Le wording “Comprendre ce qui sort, ce qui rentre, et quelles lignes méritent une vérification.”
- Toute la section d’introduction : “Aujourd’hui / Tes flux en clair / Le résumé avant les catégories et la table de transactions”.
- Les KPI d’intro actuels s’ils restent isolés comme une couche de résumé trop verbeuse : Dépenses, Revenus, Solde de période, À revoir.
- Le bloc “Ce qui pèse le plus”.
- Le bloc “Poste principal / Unknown / À comparer avec tes budgets et objectifs avant de couper quoi que ce soit”.
- Le bloc “Prochaines actions”.
- Les actions “Revoir les dernières lignes”, “Voir les objectifs”, “Demander à l’Advisor”.
- Toute la section “Projection fin de mois” avec admin, modèle linéaire explicable, trajectoire projetée et message d’historique insuffisant.

### À garder
- La structure globale de la page.
- La partie “Structure”.
- La partie “Transactions”.
- L’idée d’une lecture par catégories/groupes.
- La table des transactions.

### À ajouter / réorganiser
- Une page centrée sur deux grands espaces :
  1. Structure des dépenses.
  2. Transactions.
- D’un côté : les transactions.
- De l’autre : les groupes/catégories, avec top groupes et top dépenses.
- Conserver une lecture rapide mais sans phrases explicatives artificielles.

### Nouvelle intention de la page dépenses
La page dépenses doit permettre de comprendre rapidement :
- où part l’argent ;
- quelles catégories pèsent le plus ;
- quelles transactions composent ces catégories ;
- quelles lignes méritent éventuellement une correction de catégorie.

Elle ne doit pas être une page d’Advisor, ni une page de projection financière.

### Direction d’architecture d’information dépenses cible
Priorité recommandée :
1. Titre simple : “Dépenses”.
2. Contrôles utiles : période, export CSV.
3. Vue catégories/groupes : top catégories, poids relatif, montant.
4. Vue top dépenses : transactions principales.
5. Table transactions : date, libellé, catégorie, montant, action d’édition.
6. État “transactions sans catégorie” discret et actionnable si utile.

### Contraintes dépenses
- Pas de bloc Advisor.
- Pas de projections fin de mois sur cette page.
- Pas de wording type “lecture simple”, “ce qui pèse”, “prochaines actions”.
- Pas de contenu admin visible dans le flux principal.
- Garder la page utile, dense et directe.
- Wording plus naturel, plus court, moins explicatif.

## 15.3 Feedback utilisateur — Page patrimoine
Source : screenshot patrimoine + note utilisateur `note_patrimoine.md`.

### Ce qui ne convient pas
- Le principal problème est le wording.
- Le wording est encore trop “IA”.
- Certains libellés sont trop techniques.
- La page fonctionne globalement bien et ne nécessite pas une suppression massive.

### À supprimer / réduire
- Le bruit rédactionnel.
- Les formulations trop explicatives.
- Les tournures type “lecture simple”, “données à vérifier”, “prochaines actions”, si elles donnent une impression d’IA ou d’outil qui commente trop.
- Les formulations techniques visibles sans nécessité.

### À garder
- Globalement toute la page.
- Le grand montant patrimoine net.
- La courbe d’évolution.
- La répartition liquidités / investissements / manuel.
- Les comptes et actifs.
- Les investissements externes.
- La partie actifs manuels admin, si elle reste confinée au bon niveau.

### À ajouter / ajuster
- Revoir le wording global pour le rendre plus direct, plus naturel, plus produit.
- Garder la structure mais alléger les textes.
- Mieux distinguer les zones réellement utiles utilisateur et les zones admin/debug.
- Conserver une page patrimoine complète, mais plus calme et plus lisible.

### Nouvelle intention patrimoine
La page patrimoine doit rester la page de référence pour comprendre la valeur globale, la répartition et le détail des actifs.
Contrairement au cockpit et à la page dépenses, il ne faut pas retirer beaucoup de contenu : il faut surtout nettoyer la langue et améliorer la clarté.

### Direction d’architecture d’information patrimoine cible
Priorité recommandée :
1. Patrimoine total.
2. Évolution sur la période.
3. Répartition : liquidités, investissements, manuel.
4. Soldes par connexion.
5. Actifs détaillés.
6. Investissements externes.
7. Actifs manuels admin.

### Contraintes patrimoine
- Ne pas faire une refonte destructrice.
- Garder la profondeur de la page.
- Remplacer le wording trop IA par des libellés courts.
- Les zones admin doivent rester identifiables sans polluer la lecture principale.
- Garder une lecture patrimoniale complète, mais moins bavarde.

## 15.4 Feedback utilisateur — Page investissements
Source : screenshot investissements + note utilisateur `note_investissements.md`.

### Ce qui ne convient pas
- La page est difficile à comprendre.
- Le vocabulaire est trop technique.
- L’utilité de plusieurs blocs est discutable.
- Le wording est encore beaucoup trop “IA”.
- La page contient trop de bruit.
- Le contenu ressemble davantage à une page de diagnostic technique qu’à une page d’investissement utilisable.

### À supprimer / réduire fortement
- Bloc “Données à vérifier”.
- Message “Coût inconnu: binance:BTC” dans le flux principal.
- Bloc “Prochaines actions”.
- Actions “Vérifier les données”, “Demander à l’Advisor”, “Voir le patrimoine global”.
- Toute la section “Positions et allocations” dans sa forme actuelle.
- Toute la section “Pourquoi ce benchmark diffère”.
- Les termes techniques visibles en premier niveau : coût inconnu, prix de marché, fraîcheur, garde-fous read-only, confiance high/medium/low, benchmark, concentration, cash drag, qualité des données incomplète.

### À clarifier / repenser
- La finalité de la page : l’utilisateur doit comprendre rapidement combien valent ses investissements, où ils sont, comment ils évoluent, et ce qui mérite éventuellement attention.
- Les données techniques doivent être déplacées dans un mode détail, diagnostic ou admin.
- La page ne doit pas demander à l’utilisateur de comprendre des concepts internes pour savoir où il en est.

### Nouvelle intention investissements
La page investissements doit répondre simplement :
- combien valent mes investissements ;
- où est mon argent investi ;
- quels comptes/providers sont concernés ;
- quelles positions principales j’ai ;
- combien j’ai gagné/perdu ;
- quelles données sont manquantes uniquement si cela gêne réellement la lecture.

### Direction d’architecture d’information investissements cible
Priorité recommandée :
1. Valeur totale des investissements.
2. Variation / gain-perte sur la période.
3. Répartition par provider : Binance, Trade Republic, IBKR, Powens si pertinent.
4. Répartition par type : crypto, cash, actions/ETF, autres.
5. Positions principales lisibles.
6. Alertes de données uniquement si bloquantes, avec wording simple.
7. Détails techniques et benchmark uniquement dans un panneau “Détails” ou admin/debug.

### Contraintes investissements
- Ne pas afficher Advisor par défaut.
- Ne pas afficher benchmark technique dans le flux principal.
- Ne pas afficher diagnostics data-quality au premier niveau, sauf si ça empêche de comprendre les montants.
- Remplacer les termes techniques par des formulations simples.
- Faire une page orientée compréhension rapide, pas audit de provider.
- Clarifier la frontière avec `/ia/strategie-investissement` : cette page doit montrer l’état du portefeuille, pas porter la stratégie complète.

## 15.5 Décision utilisateur — Suppression complète fiscalité
Source : décision utilisateur dans la conversation.

### Décision
- Supprimer la page fiscalité.
- Supprimer le code mort frontend et backend qui en découle.
- La feature fiscalité ne sert pas pour l’instant.
- L’utilisateur ne comprend pas la page et ne souhaite pas la conserver dans le produit actuel.

### Portée cible
- Retirer la route frontend `/_app/fiscalite`.
- Retirer l’entrée de navigation fiscalité.
- Retirer les composants frontend uniquement utilisés par fiscalité.
- Retirer les query options/hooks/types frontend uniquement liés à fiscalité.
- Retirer les routes API fiscalité uniquement si elles ne sont consommées nulle part ailleurs.
- Retirer les use-cases/services/repos backend fiscalité uniquement s’ils sont strictement isolés.
- Retirer les mocks/demo fixtures fiscalité uniquement si strictement liés à cette feature.
- Retirer les tests uniquement liés à fiscalité.
- Mettre à jour les docs/inventaires qui mentionnent fiscalité comme page active.

### Contraintes de suppression
- Ne pas supprimer les données ou modèles partagés utilisés par patrimoine, investissements, transactions, external investments, Powens ou fiscalité future générique si leur usage dépasse la page fiscalité.
- Faire une recherche exhaustive des imports/références avant suppression.
- Supprimer par `git rm` les fichiers suivis réellement supprimés.
- Vérifier TypeScript, lint, tests ciblés et build web/api si possible.
- Si une table DB existe uniquement pour fiscalité, ne pas dropper sans analyse explicite et migration dédiée. Pour cette passe, préférer supprimer le code applicatif mort sans migration destructrice.

### Impact produit
- La nav cockpit personnel doit retirer Fiscalité.
- Le produit se concentre sur : cockpit, dépenses, patrimoine, investissements, objectifs, Advisor, intégrations/signaux utiles.
- La fiscalité pourra revenir plus tard comme nouvelle feature, avec une UX repensée, si besoin.

## 15.6 Feedback utilisateur — Page objectifs
Source : décision utilisateur dans la conversation.

### Ce qui ne convient pas
- La page Objectifs est globalement bien.
- Le problème principal est qu’elle est “too much”.
- Le hero avec animation ReactBits est jugé horrible.
- Le bloc “Prochaines actions” est insupportable et doit disparaître.
- Ce pattern “Prochaines actions” étant présent sur beaucoup de pages, il doit être supprimé globalement ou très fortement réduit.

### À supprimer sur Objectifs
- Le hero animé ReactBits.
- L’animation ReactBits associée à la page Objectifs, probablement `antigravity` selon l’audit Phase 0.
- Le bloc “Prochaines actions”.
- Les entrées : “Créer ou mettre à jour un objectif”, “Comparer avec les dépenses”, “Demander à l’Advisor”.
- Le wording explicatif : “Relier les objectifs au cashflow et au patrimoine”.

### À garder
- La page Objectifs en elle-même.
- Les fonctionnalités principales de suivi/création/mise à jour d’objectifs.
- Une structure simple, utile, sans effet démonstratif.

### Décision globale — suppression du pattern “Prochaines actions”
Le pattern “Prochaines actions” est à retirer de l’application dans sa forme actuelle.
Il est perçu comme :
- trop verbeux ;
- trop IA ;
- répétitif ;
- artificiel ;
- inutile sur les pages métier ;
- source de bruit visuel.

### Règle globale cible
Les pages Finance-OS ne doivent plus afficher de bloc générique “Prochaines actions”.
À la place :
- garder uniquement des CTA contextuels, rares, directement liés à une action principale ;
- placer les actions secondaires dans la zone concernée, pas dans un panneau répétitif ;
- ne jamais proposer “Demander à l’Advisor” partout par défaut ;
- ne pas transformer chaque page en assistant ou coach.

### Nouvelle intention Objectifs
La page Objectifs doit rester sobre : montrer les objectifs, leur progression, les montants, les dates, et permettre la création ou modification si nécessaire.
Elle ne doit pas avoir de hero décoratif ni d’animation ReactBits.

### Direction d’architecture d’information Objectifs cible
Priorité recommandée :
1. Titre simple : “Objectifs”.
2. Liste ou grille des objectifs.
3. Progression par objectif.
4. Montant cible, montant actuel, échéance.
5. CTA principal discret : “Ajouter un objectif” ou “Modifier”.
6. État vide simple si aucun objectif.

### Contraintes Objectifs
- Pas de ReactBits.
- Pas de hero animé.
- Pas de bloc “Prochaines actions”.
- Pas de CTA Advisor par défaut.
- Page sobre, claire, utile.

## 15.7 Feedback utilisateur — Pages IA / Advisor / Chat / Mémoire / Graph 3D
Source : décision utilisateur + screenshot knowledge graph dans la conversation.

### Diagnostic général utilisateur
- La majeure partie de la partie IA est indigeste.
- Il y a beaucoup trop de bruit.
- Il y a trop de termes techniques.
- Le wording est trop IA.
- Il y a trop d’explications.
- L’ensemble est difficile à comprendre rapidement.
- L’utilisateur veut une IA beaucoup plus minimaliste, claire et compréhensible.

### Direction globale IA cible
Réduire la partie IA à trois expériences principales :
1. Une page chat minimaliste.
2. Une page graph 3D immersive pour explorer la mémoire, avec recherche et filtres uniquement.
3. Une page Advisor simple avec recommandations d’investissement et conseils financiers courts.

### Page Chat IA cible
- Interface minimaliste.
- Peu de chrome UI.
- Pas de panneaux techniques.
- Pas de contexte affiché en permanence.
- Pas d’explications sur le fonctionnement interne.
- L’utilisateur doit pouvoir discuter simplement avec l’IA.

### Page Graph 3D cible
Objectif : plaisir d’exploration, effet cool/wow, mémoire visuelle.

À garder :
- Le graph 3D.
- La recherche.
- Les filtres.

À changer :
- Le graph doit prendre une beaucoup plus grosse partie de l’écran.
- Le contenu affiché au survol d’un nœud doit être human-readable.
- Ne jamais afficher un objet JSON brut dans le tooltip.
- Exemple actuel à corriger : `hypothesis_created: {"planId":1,"itemId":2,"symbol":"CORE_ETF_REVIEW",...}`.
- Il faut transformer les payloads techniques en libellés simples : titre, type, confiance, fraîcheur, source, résumé.

À supprimer :
- Tout le reste qui n’est pas recherche/filtres/exploration.
- Panneaux secondaires trop techniques.
- Statistiques, debug, détails backend, vocabulaire GraphRAG si visibles.
- Toute explication qui empêche la page d’être simple, cool et wow.

### Page Advisor cible
Objectif : conseils compréhensibles et directement utiles.

Contenu souhaité :
- Une liste des actifs / cryptos / ETF / autres instruments que l’Advisor recommande d’acheter ou de surveiller.
- La valeur / montant concerné pour chaque recommandation.
- Une recommandation un peu plus textuelle sur les dépenses.
- Une recommandation courte sur l’état actuel des finances.

À éviter :
- Trop d’explications.
- Trop de scorecards.
- Trop de termes techniques.
- Trop de panels.
- Trop de contexte interne.
- Trop de détails sur comment l’Advisor raisonne.

### Nouvelle architecture IA cible
- `/ia/chat` : chat minimaliste.
- `/ia/memoire/graph` : exploration 3D plein écran ou quasi plein écran, recherche + filtres.
- `/ia` ou `/ia/advisor` : recommandations simples et utiles.
- Les pages techniques IA actuelles doivent être supprimées, cachées ou déplacées en admin/debug si elles ne servent pas l’utilisateur.

### Contraintes IA globales
- L’IA ne doit pas envahir toutes les pages.
- Pas de CTA “Demander à l’Advisor” partout.
- Pas de wording IA/corporate.
- Pas de JSON brut exposé à l’utilisateur.
- Pas de GraphRAG/knowledge/context-bundle visible en wording utilisateur.
- Les informations techniques doivent être déplacées en debug/admin.
- Chaque page IA doit avoir une intention unique.
- Le graph peut être spectaculaire, mais le reste de l’IA doit être sobre.

### Bug / correction à prévoir
- Tooltip node graph : ne pas afficher les payloads JSON bruts.
- Mapper chaque node vers un view-model UI avec champs propres : `title`, `kindLabel`, `summary`, `confidence`, `freshness`, `sourceLabel`.
- Prévoir fallback si payload inconnu : “Élément mémoire” + résumé court, pas JSON.

## 15.8 Décision utilisateur — Debug mémoire graph / Qdrant / Neo4j
Source : décision utilisateur dans la conversation.

### Problème observé
- Le graph 3D semble contenir quasi uniquement des hypothèses.
- Cela paraît étrange pour une “mémoire” Finance-OS : on devrait voir une diversité plus claire de nœuds, par exemple décisions, transactions synthétisées, actifs, recommandations, signaux, objectifs, événements, sources, alertes, conversations ou résumés.
- L’utilisateur n’a pas l’impression que la base mémoire graph Qdrant + Neo4j fonctionne correctement.

### Décision
Ajouter une phase de debug dédiée à la mémoire IA / graph database / vector database, après la finalisation de l’inventaire UI/UX et avant ou pendant la refonte IA.

### Objectifs de la phase debug
- Vérifier que Neo4j reçoit bien les nœuds et relations attendus.
- Vérifier que Qdrant reçoit bien les points/vector embeddings attendus.
- Vérifier que les jobs d’ingestion mémoire tournent réellement.
- Vérifier que les types de nœuds ne sont pas filtrés par erreur côté API ou frontend.
- Vérifier que le endpoint graph ne retourne pas uniquement les hypothèses par bug de requête, de mapping ou de fallback.
- Vérifier que le fallback déterministe ne masque pas une panne Neo4j/Qdrant.
- Vérifier que les DTO Graph envoyés au frontend sont diversifiés, propres, redacted et human-readable.

### Checks attendus
- Santé containers/services Neo4j, Qdrant, knowledge-service.
- Logs knowledge-service.
- Logs Neo4j et requêtes Cypher clés.
- Health endpoints Qdrant.
- Liste des collections Qdrant et nombre de points.
- Scroll/sample des points Qdrant avec payloads redacted.
- Comptage Neo4j par label/type de nœud.
- Comptage Neo4j par relation.
- Comparaison source DB → knowledge-service → API endpoint → frontend view-model.
- Vérification demo/admin/fallback.

### Bugs UI à corriger côté graph
- Tooltip node : aucun JSON brut.
- Les nodes doivent être transformés en view-model lisible.
- Le graph doit afficher une mémoire diversifiée, ou expliquer clairement pourquoi certaines familles de nœuds sont absentes.

### Phase à ajouter dans la roadmap
Phase IA-0 — Debug Memory Infrastructure :
1. Audit ingestion Neo4j/Qdrant.
2. Audit endpoint graph DTO.
3. Audit fallback/dégradation.
4. Audit diversité des nœuds.
5. Correction tooltip JSON brut.
6. Rapport avant refonte visuelle du graph.

## 15.9 Feedback utilisateur — Pages Signaux / Marchés / News
Source : décision utilisateur dans la conversation.

### Diagnostic utilisateur
- La page Marchés est plutôt cool.
- La partie Signaux avec les news a un layout jugé absolument horrible.
- Les pages Signaux/Marchés servent peu à l’utilisateur : il n’y va quasiment jamais.
- L’utilisateur ne comprend pas vraiment ces pages.
- La page Signaux/news contient beaucoup trop de choses et beaucoup trop de bruit.
- L’utilité de la page Signaux côté utilisateur est douteuse.

### Point non négociable
- Ne pas supprimer le fonctionnement de fetch/ingestion des données.
- Les données news/marchés/signaux doivent continuer à être récupérées et envoyées à l’IA.
- La suppression éventuelle concerne surtout l’interface utilisateur, pas les pipelines d’ingestion ou les providers.

### Hésitation utilisateur
Deux options envisagées :
1. Supprimer les pages visibles Signaux/Marchés.
2. Fusionner Signaux + Marchés dans une version ultra minimaliste, belle, avec effet WOW, sans brouillon.

### Recommandation produit actuelle
Préférer une fusion minimaliste plutôt qu’une suppression totale de l’UI, au moins dans un premier temps.
Créer une seule page visible, par exemple :
- `Radar`
- `Marchés & signaux`
- `Veille`
- `Radar IA`

Cette page doit être une vitrine lisible et belle de ce que l’IA surveille, pas une page de debug news/provider.

### Ce que la page fusionnée devrait montrer
- Un aperçu très minimal des marchés importants.
- Quelques signaux/news sélectionnés, pas un flux complet.
- Un état discret de fraîcheur : à jour / en retard / erreur.
- Une indication claire : “Ces données alimentent l’Advisor”.
- Un CTA discret vers détails/admin si besoin.

### Ce qui doit disparaître de l’UI principale
- Layout news actuel.
- Trop grand nombre de cartes/news/items.
- Détails provider.
- Détails ingestion.
- Détails de fetch.
- Jargon source/provider/freshness non expliqué.
- Blocs techniques et debug.
- Toute interface qui ressemble à un backoffice de collecte de données.

### Ce qui doit rester côté système
- Jobs de fetch news/marchés/signaux.
- Providers news/macro/market/social utiles à l’IA.
- Stockage/cache/signaux pour Advisor.
- Endpoints internes nécessaires à l’Advisor.
- Admin/debug pages si utiles, mais séparées de l’expérience principale.

### Architecture cible possible
- Page visible minimaliste : `/signaux` ou `/radar`, fusion Signaux + Marchés.
- Pages techniques conservées uniquement en admin/debug : sources, free-firehose, provider diagnostics, fetch logs.
- L’Advisor consomme toujours les données comme avant.

### Contraintes UX
- Beaucoup moins de contenu.
- Page plus visuelle, plus wow, mais calme.
- Compréhensible en 5 secondes.
- Pas de liste exhaustive de news.
- Pas de page brouillon.
- Pas de jargon.
- Pas de suppression des pipelines IA.

## 15.10 Feedback utilisateur — Page Social Intelligence
Source : décision utilisateur dans la conversation.

### Diagnostic utilisateur
- La page Social Intelligence est globalement bien dans son idée.
- Le layout et la présence des comptes sont intéressants.
- Le wording est catastrophique : trop IA, trop verbeux, trop d’informations, trop de bruit.
- La majorité des informations actuellement affichées sont inutiles pour l’expérience principale.
- Le coût affiché dans la page doit être supprimé de cette vue.
- La sync et les coûts doivent être déplacés ailleurs, dans une future page dédiée ou zone admin/ops.
- Problème suspect : l’utilisateur a payé deux fois environ 8 € en 3 jours, ce qui semble étrange et indique possiblement un bug de calcul, de suivi, de duplication ou de facturation interne.

### Point à investiguer plus tard
- Debug du calcul des coûts Social/X/Twitter.
- Vérifier si les coûts affichés correspondent à la vraie facturation provider ou à une estimation interne.
- Vérifier les doublons de sync, retries, dry runs comptabilisés, comptes dupliqués, conversion devise, cache, et éventuelle double écriture dans le cost ledger.
- Vérifier si le prix affiché additionne X API, LLM enrichment, embeddings, stockage ou autres coûts sans séparation claire.

### À supprimer de la page principale
- Affichage du coût.
- Détails de sync.
- Détails provider techniques.
- Logs ou métriques de traitement.
- Wording IA/corporate.
- Tout élément qui explique trop le pipeline.
- Tout ce qui ressemble à une page de monitoring ou de backoffice.

### À déplacer ailleurs
- Coût d’usage.
- Historique de sync.
- Diagnostics provider.
- Erreurs techniques.
- Boutons de relance sync.
- Détails de facturation/estimation.

Destination probable : future page admin/ops/costs/sync, à définir plus tard.

### À garder dans Social Intelligence
- Les comptes suivis.
- Les métadonnées des comptes : photo de profil, pseudo, handle, bio, source, statut.
- Une présentation très stylée, minimaliste, visuelle.
- Un sentiment ou signal simple si vraiment utile.
- Une indication discrète de fraîcheur ou statut si nécessaire, sans bruit technique.

### Nouvelle intention Social Intelligence
La page doit devenir une galerie / cockpit minimaliste des comptes suivis, pas une console de coûts et sync.
Objectif : voir rapidement quels comptes alimentent l’intelligence sociale de Finance-OS, avec leurs métadonnées, dans une interface belle et claire.

### Direction d’architecture cible
1. Titre simple : “Social Intelligence” ou nom à redéfinir.
2. Grid/cards de comptes suivis.
3. Chaque card : avatar, nom, handle, bio, source, statut discret, éventuellement tags/sujets suivis.
4. Recherche / filtres si utile.
5. Aucun coût visible.
6. Aucune sync visible dans cette page.
7. Lien discret vers admin/debug si un problème existe.

### Contraintes UX
- Minimaliste.
- Design fort et stylé.
- Pas de bruit.
- Pas de coût dans la page utilisateur.
- Pas de sync visible dans la page utilisateur.
- Les métadonnées de comptes doivent être bien mises en valeur.
- La page doit donner une impression de réseau de sources qualifiées, pas de monitoring technique.

## 15.11 Décision utilisateur — Suppression page Sources
Source : décision utilisateur dans la conversation.

### Décision
- Supprimer la page Sources.
- La page ne sert à rien dans l’expérience utilisateur actuelle.
- Elle ne doit plus apparaître dans la navigation.

### Portée cible
- Retirer la route visible `/_app/signaux/sources` si elle existe toujours.
- Retirer l’entrée de navigation associée.
- Retirer les composants uniquement utilisés par cette page.
- Retirer les query options/hooks/types uniquement utilisés par cette page.
- Mettre à jour les docs/inventaires qui listent Sources comme page active.

### Contraintes importantes
- Ne pas supprimer les providers de données.
- Ne pas supprimer les pipelines d’ingestion news/marchés/signaux/social.
- Ne pas supprimer les endpoints internes utilisés par l’Advisor ou les workers.
- Ne pas supprimer les diagnostics système s’ils doivent être déplacés plus tard vers une page admin/ops.
- La suppression concerne la page UI visible, pas le fonctionnement de collecte de données.

### Destination possible des informations utiles
- Si certaines infos de Sources sont réellement utiles, elles doivent être déplacées plus tard vers une page admin/ops dédiée : santé providers, coûts, sync, logs, diagnostics.

### Impact produit
- La section Signaux doit être simplifiée.
- La future page `Radar` / `Veille` / `Marchés & signaux` doit rester minimaliste.
- Les détails de sources ne doivent pas polluer l’expérience utilisateur.

## 15.12 Décision utilisateur — Centraliser les runs manuels dans Orchestration
Source : décision utilisateur dans la conversation.

### Décision
- La page Orchestration est jugée bien et doit devenir le centre des runs manuels.
- La page Free Firehose doit être supprimée comme page séparée.
- Les fonctionnalités Free Firehose doivent être intégrées dans Orchestration.
- Les runs Twitter/X doivent aussi être intégrés dans Orchestration.
- Tous les runs manuels doivent vivre dans cette page.

### Portée cible
- Conserver et renforcer `/_app/orchestration`.
- Retirer la page visible `/_app/signaux/free-firehose`.
- Retirer l’entrée nav Free Firehose.
- Déplacer ou réutiliser les composants/logiciels UI utiles de Free Firehose dans Orchestration.
- Ajouter dans Orchestration une section dédiée aux runs manuels.
- Ajouter dans Orchestration les déclencheurs Twitter/X et Social Intelligence.
- Ajouter dans Orchestration les déclencheurs Free Firehose.
- Ajouter dans Orchestration les autres runs manuels pertinents : refresh global, Powens sync, market data refresh, news ingestion, social ingestion, advisor context bundle, etc. si disponibles.

### Contraintes importantes
- Ne pas supprimer les endpoints backend Free Firehose s’ils sont utilisés pour déclencher l’ingestion.
- Ne pas supprimer le fonctionnement de fetch/ingestion.
- Ne pas supprimer les jobs ni les workers.
- Supprimer uniquement la page UI séparée et les doublons inutiles.
- Orchestration doit rester admin-only.
- Les runs manuels doivent être regroupés et compréhensibles.

### Architecture cible Orchestration
Sections possibles :
1. Vue d’ensemble : dernier run global, état, prochaines automatisations.
2. Runs manuels : cartes/boutons de déclenchement.
3. Jobs de données : news, marchés, social, X/Twitter, Free Firehose.
4. Jobs financiers : Powens, transactions, investissements externes.
5. Jobs IA : context bundle, advisor refresh, memory graph, evals si pertinents.
6. Historique récent : derniers runs, statut, durée, erreurs.
7. Détails/debug : collapsible ou drawer.

### UX cible
- Page admin propre, claire, mais pas bruyante.
- Un bouton = un run compréhensible.
- Chaque run doit afficher : nom, dernière exécution, statut, durée, action principale.
- Les détails techniques doivent être dans un drawer/collapsible.
- Aucun wording IA/corporate inutile.
- Aucun doublon entre Orchestration, Free Firehose et Social Intelligence.

### Impact produit
- `/_app/orchestration` devient la page unique pour lancer et surveiller les runs manuels.
- `/_app/signaux/free-firehose` disparaît de l’UI.
- La section Signaux/Radar reste minimaliste côté utilisateur.
- Les tâches techniques restent accessibles, mais confinées dans Orchestration.

## 15.13 Décision utilisateur — Trading Lab hors scope immédiat
Source : décision utilisateur dans la conversation.

### Décision
- Ne pas toucher à la page Trading Lab pour l’instant.
- Trading Lab sera une tâche énorme à part.
- La page fera quand même partie de la refonte design globale, mais pas de la refonte fonctionnelle ou IA immédiate.

### Portée actuelle
- Conserver la route Trading Lab.
- Ne pas supprimer la page.
- Ne pas refactorer sa logique métier.
- Ne pas réorganiser les fonctionnalités internes.
- Ne pas fusionner Trading Lab avec Advisor ou Investissements pour l’instant.

### Ce qui est autorisé dans la refonte globale
- Harmonisation visuelle légère.
- Application des nouveaux tokens globaux.
- Ajustement spacing/surfaces/typographie si nécessaire.
- Mise en cohérence avec le design system.
- Correction de wording uniquement si évident et non fonctionnel.

### Ce qui est interdit pour l’instant
- Refonte profonde du Trading Lab.
- Changement de logique backtest/scénarios/stratégies.
- Changement d’architecture data.
- Suppression de fonctionnalités.
- Fusion avec Advisor, Investissements ou Graph.

### Phase future dédiée
Prévoir une phase séparée : `Trading Lab redesign & product strategy`.
Cette phase devra traiter :
- rôle exact du Trading Lab dans Finance-OS ;
- séparation recherche/backtest/advisor ;
- lisibilité des stratégies ;
- visualisations ;
- simulation paper-only ;
- sécurité et garde-fous no-auto-trade ;
- UX expert vs utilisateur normal.

## 15.14 Décision utilisateur — Page Coûts globale
Source : décision utilisateur dans la conversation.

### Décision
- La page “Coût IA” doit devenir une page “Coûts” globale.
- Elle doit centraliser tout ce qui coûte de l’argent et qui peut être capté/calculé par le code.
- Exemples : IA, X/Twitter, enrichissement LLM, embeddings, providers payants, APIs externes, stockage ou autres coûts mesurables.

### Nouvelle intention
La page Coûts doit répondre clairement :
- combien Finance-OS coûte réellement ou estime coûter ;
- quel service coûte combien ;
- quelle partie est coût réel vs estimation ;
- quels coûts sont liés à l’IA ;
- quels coûts sont liés à X/Twitter/social ;
- quels coûts sont liés aux autres providers ;
- quels runs ou fonctionnalités consomment le plus.

### À inclure
- Coût total sur période : jour / semaine / mois.
- Breakdown par source : IA, X/Twitter, embeddings, market/news providers, infra si mesurable.
- Breakdown par type : réel, estimé, simulé, inconnu.
- Historique des coûts.
- Dernières opérations coûteuses.
- Alertes d’anomalie : double coût, pic inhabituel, estimation suspecte.
- Distinction claire entre coût provider réel et estimation interne.

### À déplacer vers cette page depuis d’autres pages
- Coût Social Intelligence / X/Twitter.
- Coût IA Advisor.
- Coût des enrichissements LLM.
- Coûts liés aux runs manuels si mesurables.
- Éventuels coûts de sync/fetch providers.

### À retirer des pages métier
- Ne pas afficher les coûts dans Social Intelligence.
- Ne pas afficher les coûts sur les pages utilisateur principales.
- Ne pas afficher les coûts dans le cockpit, sauf alerte critique très discrète.
- Garder les coûts dans une page admin/ops dédiée.

### Contraintes data
- Chaque coût doit avoir : provider, source, feature, runId si disponible, type coût réel/estimé, devise, montant, timestamp, environnement, mode demo/admin, metadata redacted.
- Les coûts réels et estimés doivent être séparés visuellement et en données.
- Les dry-runs ne doivent pas être comptés comme coût réel.
- Les retries/doublons doivent être détectables.
- Les conversions devise doivent être explicites.

### Bugs / audits à prévoir
- Vérifier pourquoi X/Twitter/Social a coûté environ 2 × 8 € en 3 jours.
- Vérifier double écriture dans cost ledger.
- Vérifier dry run comptabilisé comme run réel.
- Vérifier retries ou doublons de sync.
- Vérifier estimation vs coût réellement payé.
- Vérifier séparation X API / LLM enrichment / embeddings.

### UX cible
- Page admin/ops claire, pas anxiogène.
- Dashboard coût sobre : total, tendance, breakdown, anomalies.
- Pas de wording IA/corporate.
- Les coûts doivent être lisibles et vérifiables.
- Les détails techniques restent en drilldown.

### Navigation cible
- Renommer `Coût IA` en `Coûts`.
- Garder probablement dans la section admin/expert/ops.
- La page devient la destination officielle pour toutes les infos coût.

## 15.15 Feedback utilisateur — Page Intégrations
Source : décision utilisateur dans la conversation.

### Diagnostic utilisateur
- La page Intégrations est globalement bien.
- Elle doit suivre les mêmes règles que les autres pages : wording moins IA, réduction du bruit, aller à l’essentiel.
- L’objectif est une page plus ergonomique, plus agréable, plus lisible.

### Ce qui ne convient pas
- Wording trop IA / trop explicatif.
- Trop d’informations visibles en premier niveau.
- Trop de détails techniques autour des providers, syncs, états et logs.
- Risque de page qui ressemble à une console technique plutôt qu’à une page de gestion de connexions.

### À garder
- La page Intégrations.
- Les providers/connecteurs principaux : Powens, IBKR, Binance, et autres intégrations utiles.
- Les statuts essentiels : connecté / à reconnecter / erreur / dernière mise à jour.
- Les actions utiles : connecter, reconnecter, synchroniser si nécessaire.

### À réduire / déplacer
- Logs de sync.
- Détails provider avancés.
- Diagnostics techniques.
- Historique détaillé.
- Erreurs longues ou codes backend.
- Coûts éventuels, à déplacer vers la page Coûts.
- Runs manuels, à déplacer vers Orchestration.

### Nouvelle intention Intégrations
La page Intégrations doit répondre simplement :
- quelles connexions sont actives ;
- lesquelles ont un problème ;
- quand elles ont été mises à jour ;
- quelle action simple je peux faire.

### Direction d’architecture cible
1. Titre simple : “Intégrations” ou “Connexions”.
2. Cards provider : Powens, IBKR, Binance, X/Twitter si pertinent.
3. Pour chaque card : nom, usage, statut, dernière sync, action principale.
4. Statut global discret : tout va bien / attention requise.
5. Détails avancés uniquement en drawer ou accordéon admin.
6. Aucun coût sur cette page.
7. Aucun historique de run détaillé dans cette page.

### Contraintes UX
- Page propre, claire, agréable.
- Un provider = une card lisible.
- Pas de jargon technique au premier niveau.
- Les problèmes doivent être actionnables.
- Les détails techniques partent dans Orchestration, Coûts ou Diagnostic.
- Ne pas casser les flows de connexion/reconnexion, surtout Powens/OAuth.

## 15.16 Feedback utilisateur — Page Santé + suppression Env Diagnostics
Source : décision utilisateur dans la conversation.

### Page Santé — décision
- La page Santé reste, mais doit suivre les mêmes règles que les autres pages.
- Réduire le wording IA/corporate.
- Réduire le bruit.
- Aller à l’essentiel.
- La page doit devenir plus ergonomique, agréable, lisible et utile.

### Page Santé — intention cible
La page Santé doit répondre simplement :
- est-ce que l’application va bien ;
- est-ce que les données sont fraîches ;
- est-ce que les providers sont OK ;
- est-ce qu’un élément demande une action ;
- où aller pour corriger ou diagnostiquer.

### Page Santé — à garder
- Un état global clair : OK / attention / erreur.
- Les statuts essentiels des systèmes et providers.
- Les alertes importantes.
- Les liens vers la bonne page de résolution si nécessaire.

### Page Santé — à réduire / déplacer
- Détails techniques avancés.
- Logs.
- Wording explicatif long.
- Statuts backend bruts.
- Codes erreur non vulgarisés.
- Sync/run details : à déplacer vers Orchestration.
- Coûts : à déplacer vers Coûts.
- Diagnostics très techniques : à intégrer uniquement si actionnables, sinon supprimer ou cacher.

### Page Santé — contraintes UX
- Pas de hero décoratif.
- Pas de ReactBits / PixelBlast sur cette page.
- Pas de wording anxiogène ou trop technique.
- Pas de monitoring exhaustif en premier niveau.
- Une page de santé doit être claire en 5 secondes.

### Env Diagnostics — décision de suppression
- La page Env Diagnostics doit être supprimée.
- Elle ne sert à rien dans l’expérience actuelle.
- Elle doit sortir de la navigation et des routes visibles.

### Env Diagnostics — portée cible
- Retirer la route `/_app/ops-env-diagnostics` si elle existe toujours.
- Retirer l’entrée de navigation associée.
- Retirer les composants/hooks uniquement utilisés par cette page.
- Mettre à jour les docs/inventaires qui la listent comme page active.

### Env Diagnostics — contraintes importantes
- Ne pas supprimer les validations d’environnement réellement utilisées au boot/runtime.
- Ne pas supprimer les helpers env partagés.
- Ne pas supprimer les checks critiques backend/infra.
- Si certaines informations sont encore utiles, elles doivent être déplacées dans Santé, Orchestration ou une zone admin debug cachée, mais pas rester comme page dédiée.

### Impact produit
- Santé devient la page lisible de statut global.
- Env Diagnostics disparaît comme page séparée.
- Orchestration accueille les runs manuels.
- Coûts accueille les dépenses mesurables.
- Les détails techniques cessent d’être dispersés dans plusieurs pages.

## 15.17 Décision utilisateur — Page Paramètres à challenger / supprimer si inutile
Source : décision utilisateur dans la conversation.

### Diagnostic utilisateur
- La page Paramètres ne sert actuellement à rien.
- Elle contient surtout des informations jugées inutiles.
- Les notifications ne fonctionnent pas actuellement.
- L’utilisateur penche vers une suppression de la page, sauf si Codex/Claude trouve des fonctionnalités réellement utiles à conserver.

### Décision provisoire
- Ne pas considérer Paramètres comme une page prioritaire à refondre.
- Auditer d’abord son utilité réelle.
- Si la page ne contient rien d’essentiel, la supprimer.
- Si certains réglages sont utiles, les conserver mais dans une version très minimale.

### À vérifier avant suppression
- La page contient-elle des réglages réellement nécessaires ?
- Le theme toggle dépend-il de cette page ou vit-il dans le shell ?
- Les notifications push sont-elles censées fonctionner ?
- Existe-t-il une vraie logique backend/service worker/push subscription ?
- Des exports ou recompute actions importants sont-ils accessibles uniquement depuis cette page ?
- Des préférences utilisateur/admin sont-elles stockées via cette page ?
- La page est-elle référencée ailleurs : nav, command palette, docs, tests ?

### Hypothèse préférée
Supprimer la page Paramètres si elle ne contient que :
- notifications non fonctionnelles ;
- informations statiques inutiles ;
- placeholders ;
- actions techniques déplacables ailleurs.

### Si certains éléments utiles existent
Les déplacer plutôt que garder une page entière :
- Notifications : à corriger plus tard ou supprimer si non prioritaires.
- Exports : à placer dans les pages concernées ou Orchestration.
- Recompute/admin actions : à placer dans Orchestration.
- Theme toggle : à garder dans le shell, pas forcément dans Paramètres.
- Debug/config : à déplacer dans admin/ops, pas dans une page utilisateur.

### Contraintes de suppression
- Ne pas supprimer une logique partagée de notification/service worker sans audit.
- Ne pas casser le PWA install prompt ou service worker si présent.
- Ne pas supprimer des préférences globales utiles au thème/accessibilité.
- Supprimer la route et la nav uniquement après confirmation qu’aucun réglage essentiel n’est dépendant de cette page.

### UX cible si conservée
Si la page est conservée, elle doit devenir une page très courte :
- Compte / mode admin-demo si nécessaire.
- Apparence si pas déjà dans le shell.
- Notifications uniquement si fonctionnelles.
- Exports importants.
- Aucune information décorative ou placeholder.

## 15.18 Remarques globales utilisateur — Refactor UI/UX général
Source : décision utilisateur dans la conversation.

### Décisions globales design / UI
- L’utilisateur ne veut plus de ReactBits dans l’application, sauf le background du login qui est apprécié et doit être conservé.
- La page login est à refaire, mais son background actuel doit être conservé.
- Le design actuel est jugé “too much” et en fait trop.
- Aurora Pink ne plaît pas du tout : ne pas partir sur Aurora Pink v2 par défaut.
- La future DA sera définie plus tard via inspirations utilisateur.
- Le bento menu doit disparaître.
- Tout ce qui est ASCII doit disparaître : glyphes, symboles, esthétique ASCII mal gérée.
- La sidebar doit être remplacée par une navbar en haut.
- Le menu doit être mieux organisé.

### Décisions globales wording
- Le wording actuel est trop IA.
- Le produit sur-explique trop.
- Le ton doit devenir plus naturel, direct, court, premium, utile.
- Supprimer les formulations de type “Prochaines actions”, “Demander à l’Advisor” partout, “lecture simple”, “bruit expert”, etc.
- Les pages doivent arrêter de commenter les données comme un assistant.

### ReactBits
À supprimer partout sauf exception :
- Exception conservée : background du login.
- À supprimer ou remplacer : hero cockpit, antigravity objectifs, PixelBlast santé, TextPressure si associé aux pages internes, effets décoratifs non indispensables, bento menu, autres ReactBits morts ou actifs.
- Garder uniquement si explicitement validé dans la DA future, mais par défaut : suppression.

### Navigation
- Remplacer la sidebar actuelle par une navbar top.
- Réorganiser le menu selon la nouvelle IA produit.
- Attente d’inspirations utilisateur pour le style exact de la navbar.
- La navigation doit mieux séparer : utilisateur principal, IA, admin/ops.

### Runs / automatisations
- L’utilisateur a l’impression que les runs se lancent trop souvent.
- Ajouter une grosse passe d’audit sur la fréquence des runs.
- Vérifier les cron, workers, triggers manuels, retries, duplicates, auto-syncs, dry-runs, queue, locks Redis, et jobs qui se relancent trop souvent.
- Objectif : réduire coûts, bruit, charge et comportements inattendus.

### Catégorisation intelligente des dépenses
- Le système doit apprendre quand l’utilisateur catégorise une dépense.
- Quand une transaction est corrigée/catégorisée, Finance-OS doit mémoriser ce signal pour mieux catégoriser les futures dépenses similaires.
- Prévoir une mémoire/règle de catégorisation : merchant normalization, libellé transaction, montant, compte, catégorie choisie, confiance, règles utilisateur.
- Objectif : meilleure catégorisation automatique, moins de corrections répétées.

### Ambition UI/UX finale
- UI magnifique, à couper le souffle.
- Belles couleurs.
- Belles interactions et micro-interactions.
- UX parfaite, ergonomique, accessible, ultra agréable.
- Design premium, minimaliste dans l’information, mais fort dans l’exécution visuelle.
- Ne pas confondre minimalisme avec interface plate ou fade.
- L’application doit être beaucoup plus agréable, plus claire, plus utile et plus belle.

### Garde-fous UX globaux
- Une page = une intention principale.
- Moins de pages techniques visibles.
- Les détails admin/ops/coûts/sync/runs vont dans des zones dédiées.
- Les pages utilisateur montrent les informations utiles, pas les tuyaux internes.
- Les micro-interactions doivent être utiles, accessibles et performantes.
- Respect strict du reduced motion.
- Garder accessibilité et ergonomie comme contraintes centrales.

### À faire ensuite
- Consolider toutes les décisions dans un document de décisions UI/UX.
- Poser les dernières questions structurantes.
- Passer ensuite à la phase inspirations DA / navbar / couleurs / typographies.
- Puis produire le prompt de design pour Claude Design / Stitch.
- Puis produire le prompt d’implémentation progressive pour Claude/Codex.

## 15.19 Réponses utilisateur aux questions structurantes
Source : réponses utilisateur dans la conversation.

### Navbar top
- L’utilisateur montrera des inspirations pendant la phase design.
- Décision temporaire : ne pas figer le modèle visuel maintenant.
- Objectif : remplacer la sidebar par une top navbar optimale UX/UI, avec choix final guidé par les inspirations.

### Mobile navigation
- Choisir la solution la plus optimale et la plus UX/UI friendly.
- Recommandation actuelle à valider en design : bottom nav mobile pour les pages principales + accès admin/ops caché ou secondaire.
- Ne pas figer sans maquettes.

### Login
- L’utilisateur montrera des inspirations pendant la phase design.
- Le background ReactBits actuel du login est la seule exception ReactBits conservée.
- La page login doit être refaite autour de ce background.

### ReactBits
- Décision ferme : supprimer toute dépendance/composants ReactBits sauf le background du login.
- Pas de réutilisation de ReactBits ailleurs.
- Les futures micro-interactions devront être construites proprement hors ReactBits, légères, accessibles, compatibles reduced-motion.

### Runs / jobs
- Décision ferme : créer une phase dédiée `RUNS-0 — Audit fréquence jobs / coûts / triggers`.
- Objectif : comprendre pourquoi trop de runs semblent se lancer trop souvent.
- Périmètre : crons, workers, triggers manuels, retries, duplicates, auto-syncs, dry-runs, queues, locks Redis, cost ledger.

### Catégorisation intelligente
- Décision : approche hybride.
- Base : règles déterministes apprises des corrections utilisateur.
- Complément : l’IA doit aussi apprendre des catégorisations manuelles.
- Objectif : quand l’utilisateur corrige une catégorie, Finance-OS mémorise ce signal pour mieux catégoriser les transactions futures similaires.

### Prompts / implémentation
- Ne pas produire de prompts maintenant.
- Les prompts seront produits plus tard, après :
  1. la phase design ;
  2. le debug des problèmes actuels ;
  3. la consolidation finale du scope.
- Le travail sera ensuite découpé en plusieurs prompts séparés, pas un énorme prompt unique lancé trop tôt.

### Phase suivante
- Passer à la suite : consolidation / synthèse finale de la réorganisation produit/UI avant phase inspirations DA.

## 16. Synthèse consolidée — Réorganisation produit/UI

### 16.1 Direction générale validée
Finance-OS doit passer d’un cockpit technique/IA verbeux à une application premium, lisible, magnifique, minimale dans l’information, mais forte dans l’exécution visuelle.

Principes globaux :
- supprimer le wording IA/corporate ;
- supprimer les blocs répétitifs “Prochaines actions” ;
- supprimer les pages techniques inutiles ;
- déplacer coûts/sync/runs/diagnostics vers des pages admin/ops dédiées ;
- remplacer la sidebar par une top navbar ;
- supprimer Aurora Pink ;
- supprimer tout ReactBits sauf le background du login ;
- supprimer ASCII et bento menu ;
- réduire fortement le bruit visuel ;
- garder des micro-interactions, mais légères, accessibles, performantes ;
- conserver le dual-path demo/admin.

### 16.2 Pages principales utilisateur à garder et refondre
- Cockpit : refonte profonde, page de lecture immédiate.
- Dépenses : garder structure/transactions, supprimer bruit/projections/Advisor.
- Patrimoine : garder globalement, nettoyer wording.
- Investissements : refonte d’architecture d’information.
- Objectifs : garder, supprimer hero/ReactBits/prochaines actions.
- Intégrations : garder, rendre plus lisible et moins technique.
- Santé : garder, en faire un statut global clair.
- Social Intelligence : garder, devenir galerie de comptes suivis.
- IA Chat : page minimaliste.
- IA Advisor : recommandations simples et conseils courts.
- Mémoire graph 3D : garder comme expérience wow, mais plein écran/simple.
- Trading Lab : hors scope immédiat, seulement harmonisation visuelle globale.

### 16.3 Pages à supprimer ou retirer de l’expérience visible
- Fiscalité : supprimer feature/page et code mort associé si strictement isolé.
- Sources : supprimer page UI visible.
- Free Firehose : supprimer page dédiée, intégrer dans Orchestration.
- Env Diagnostics : supprimer page dédiée.
- Paramètres : challenger fortement, supprimer si rien d’essentiel.
- Signaux/news actuel : supprimer dans sa forme actuelle.

### 16.4 Pages à fusionner / transformer
- Signaux + Marchés → future page minimaliste “Radar”, “Veille” ou “Marchés & signaux”.
- Coût IA → Coûts globale.
- Orchestration → centre de tous les runs manuels, incluant Free Firehose et Twitter/X.

### 16.5 Nouvelle séparation produit cible
Utilisateur principal :
- Cockpit
- Dépenses
- Patrimoine
- Investissements
- Objectifs
- Advisor
- Radar
- Social Intelligence

IA :
- Chat
- Advisor
- Mémoire 3D

Admin/Ops :
- Orchestration
- Coûts
- Santé
- Intégrations avancées / diagnostics si nécessaire

Hors scope immédiat :
- Trading Lab refonte profonde

### 16.6 Debugs obligatoires avant prompts d’implémentation
- RUNS-0 : fréquence des jobs, triggers, retries, dry-runs, locks, coûts.
- COSTS-0 : audit coûts IA/X/Twitter/social, séparation réel/estimé/dry-run.
- MEMORY-0 : debug Qdrant + Neo4j + knowledge-service + endpoint graph.
- CATEGORIZATION-0 : apprentissage des corrections manuelles de dépenses.
- ROUTES-CLEANUP-0 : vérifier pages supprimables et dépendances avant delete.

### 16.7 Phase design à venir
À préparer avec inspirations utilisateur :
- direction artistique complète ;
- top navbar ;
- login ;
- palette couleurs ;
- typographies ;
- cards/surfaces ;
- data viz ;
- micro-interactions ;
- mobile navigation ;
- design system cible.

### 16.8 Contraintes non négociables
- Accessibilité WCAG comme base.
- Core Web Vitals : LCP, INP, CLS à surveiller.
- Reduced motion partout.
- Pas de JSON brut côté utilisateur.
- Pas de jargon backend/IA visible.
- Pas de suppression de pipelines utiles à l’IA.
- Pas de prompts d’implémentation tant que design + debug ne sont pas cadrés.

## 16.9 Inspirations design — Navbar top / dropdowns
Source : screenshots utilisateur d’inspirations navbar : Greptile, Factory, Nominal, Framer, Profound, Qatalog, Equals et détails de dropdown/mobile menus.

### Ce qui plaît à l’utilisateur
- Navbar top premium, élégante, très bien finie.
- Sensation “Apple touch” : propre, premium, simple, fluide.
- Mélange premium + informatique/pixel/tech.
- Dropdowns très travaillés visuellement.
- Petites illustrations/icônes/designs dans les menus.
- Direction originale et créative, mais pas brouillonne.
- UI/UX claire, agréable, avec une vraie patte.

### Ce qu’il faut traduire pour Finance-OS
- Remplacer la sidebar par une top navbar premium.
- Utiliser des dropdowns groupés par intention produit.
- Garder une structure claire : Produit principal / IA / Admin-Ops.
- Créer des petites cartes de menu avec icône, titre, description courte.
- Trouver une patte visuelle propre à Finance-OS : fintech personnelle + cockpit + OS + data calme.
- Ne pas copier les marques ou layouts exacts des inspirations.

### Direction navbar cible provisoire
- Top navbar desktop compacte.
- Dropdowns ou mega menus par groupe.
- Micro-descriptions dans les dropdowns, mais très courtes.
- Icônes/illustrations systématiques mais sobres.
- Pas d’ASCII.
- Pas de ReactBits.
- Pas de bento menu.
- Mobile : drawer/bottom nav à décider après maquettes, mais doit rester UX-friendly.

### Gestion des SVG / icônes
- Ne pas demander à Codex de créer de gros SVG illustratifs complexes à la main.
- Préférer une stratégie design system : icônes simples, cohérentes, composées depuis une librairie ou un mini set maison.
- Stratégie recommandée : choisir une librairie principale, puis créer un composant `NavIconTile` maison autour d’elle.
- Option principale recommandée : mixer une base premium sobre avec une touche pixel contrôlée.
- Librairies candidates :
  - `shadcn.io/icons/pixel` : intéressant visuellement, 450 icônes Pixel Icon affichées, mais licence CC BY 4.0 à prendre en compte.
  - `pxlkit` : très intéressant pour la patte pixel/fancy, surtout pour icônes visual assets, mais licence assets avec attribution ou paid no-attribution.
  - `pixelarticons` : propre, MIT sur le repo/free package, 800 icônes gratuites et extension pro possible.
  - `hackernoon/pixel-icon-library` : forte vibe rétro, mais licence icônes CC BY 4.0 avec attribution ou plan paid no-attribution.
  - Lucide/Phosphor/Tabler : fallback premium/utility pour les icônes fonctionnelles.
- Recommandation actuelle : ne pas baser toute l’app sur pixel icons ; utiliser les icônes pixel comme accent créatif dans la navbar/dropdowns, pas comme système complet.
- Pattern cible : `NavIconTile` avec variante `pixel` pour les menus, mais icônes fonctionnelles standards dans les tables/forms/actions critiques.
- Pour les petites illustrations style menu, privilégier :
  - icône pixel ou linéaire + badge/cadre custom ;
  - mini pictogrammes en CSS/Tailwind ;
  - formes géométriques simples ;
  - tokens de couleur par section ;
  - éventuellement un petit set SVG maison créé une fois, pas généré page par page.
- Le style doit venir du traitement visuel Finance-OS, pas de SVG complexes importés partout.
- Une étape de spike iconographique devra comparer shadcn Pixel, pxlkit, pixelarticons et éventuellement Lucide/Phosphor.

### Risques
- Copier trop littéralement les inspirations.
- Faire des dropdowns trop marketing alors que Finance-OS est une app connectée.
- Ajouter trop d’icônes décoratives.
- Créer des SVG complexes non maintenables.
- Avoir une navbar belle mais trop chargée.

### Règle provisoire
La navbar doit être premium, top-level, créative, mais elle doit rester un outil de navigation d’app. Les dropdowns doivent aider à comprendre les groupes de pages, pas devenir une landing page dans l’app.

## 16.10 Inspirations design — Typographies
Source : screenshots utilisateur + liste de polices proposée : Departure Mono, JetBrains, Droid Sans Mono, Anonymous Pro, Junicode, Office Code Pro, Terminal Grotesque, M+ M Type-1, Utara, Uncut Plan8, Geist Sans/Mono/Pixel.

### Choix typographique validé
Système typographique retenu pour Finance-OS :
1. `Geist Sans` — police principale UI, body, navigation, cards, formulaires, textes courts.
2. `Geist Mono` — chiffres financiers, tableaux, montants, metadata, code-like labels, statuts techniques/admin.
3. `Geist Pixel` — accent créatif très contrôlé pour navbar/dropdowns, logo/wordmark, micro-labels, empty states ou éléments signature.
4. `Departure Mono` — option d’expérimentation secondaire uniquement pour logo/rare accents si Geist Pixel manque de caractère.

### Pourquoi Geist comme base
- Cohérence familiale : Sans + Mono + Pixel.
- Très compatible avec la direction premium tech/Apple-like.
- Permet d’ajouter une touche pixel sans multiplier les familles.
- Bon compromis entre lisibilité, modernité, DX et DA.
- Évite l’effet patchwork typographique.

### Règles d’usage
- Maximum 2 familles principales + 1 variante accent.
- Body/UI : Geist Sans.
- Données financières : Geist Mono, avec tabular/monospace si nécessaire.
- Accent pixel : uniquement sur éléments courts, jamais sur paragraphes ou tableaux importants.
- Pas de police trop expressive dans les zones de décision financière.
- Les typos expérimentales servent la DA, mais ne doivent jamais nuire à la lisibilité.

### Classement des autres polices
- `JetBrains Mono` : très bon fallback pour chiffres/code, mais moins cohérent si Geist Mono suffit.
- `Departure Mono` : excellent accent pixel/terminal/sci-fi, fort candidat alternatif à Geist Pixel pour patte plus marquée.
- `Uncut Plan8` : très intéressant mais très typé ; à utiliser seulement en accent si choisi.
- `Terminal Grotesque` : trop punk/éditorial pour l’app principale, éventuellement moodboard uniquement.
- `Anonymous Pro` : propre mais plus daté, moins premium que Geist/JetBrains.
- `Office Code Pro` : solide mais moins distinctif.
- `Droid Sans Mono` : stable mais daté, pas assez premium pour la refonte.
- `M+ M Type-1` : intéressant mais moins aligné DA globale.
- `Utara` : beau display, mais trop display/luxe ; à éviter pour UI produit financière.
- `Junicode` : superbe caractère historique/serif mais hors direction Finance-OS, sauf piste éditoriale très spécifique non retenue.

### Décision validée
Partir sur `Geist Sans + Geist Mono + Geist Pixel` comme système typographique cible pour les maquettes Finance-OS.
Comparer uniquement en option `Geist Pixel` vs `Departure Mono` pour quelques accents créatifs très limités.
Ne pas multiplier les polices : la

## 16.11 Inspirations design — ASCII / Unicode terminal loaders
Source : liens utilisateur : ASCII Studio, unicode-spinner, CodePen ascii neural spinner, CodePen CLI/ASCII loading spinners.

### Décision design provisoire
Réintroduire l’esthétique ASCII/terminal uniquement comme accent contrôlé, pas comme langage visuel global.
Cela corrige la décision précédente “tout ASCII dégage” : ce qui doit disparaître, c’est l’ASCII décoratif mal intégré, brouillon, bruyant ou illisible. En revanche, des loaders Unicode/ASCII sobres peuvent parfaitement coller à la nouvelle DA premium + tech/pixel.

### Ce qui plaît
- Spinners Unicode façon terminal.
- Loader cerveau ASCII pour les états IA / réflexion / graph memory / advisor.
- Génération ASCII comme outil d’exploration visuelle.
- Vibe terminal claire, limpide, informatique, cohérente avec Geist Mono/Geist Pixel.

### Règles d’usage
- Utiliser ASCII/Unicode surtout pour : loading states, empty states signature, IA processing, graph memory loading, orchestration runs, coûts/runs admin, fallback skeleton créatif.
- Ne jamais utiliser ASCII pour du contenu métier important.
- Ne jamais remplacer une information financière par de l’ASCII.
- Ne jamais afficher de gros art ASCII en permanence dans les pages principales.
- Toujours fournir un texte accessible à côté ou via `aria-label`.
- Respecter `prefers-reduced-motion` : animation stoppée ou simplifiée.
- Garder un rendu court, clair, premium, pas hacker cliché.

### Outils / sources à garder
- ASCII Studio : outil pour convertir vidéo/image en frames ASCII, utile pour prototyper des assets visuels, pas à intégrer brut sans optimisation.
- unicode-spinner : candidat pour spinners Unicode/terminal, notamment si API React propre et dépendances légères confirmées.
- CodePen ASCII neural spinner : inspiration pour loader IA/cerveau, mais à réécrire proprement en React/Canvas/Pre accessible si utilisé.
- CodePen CLI/ASCII loading spinners : inspiration pour bibliothèque de frames et UI terminal, pas à copier tel quel.

### Recommandation d’implémentation future
Créer un petit composant maison plutôt que copier des CodePens :
- `TerminalSpinner`
- `AsciiBrainLoader`
- `AsciiFrame`
- `LoadingGlyph`

Ces composants devront :
- être ultra légers ;
- être SSR-safe ;
- gérer cleanup des timers ;
- respecter reduced motion ;
- avoir `aria-label` / `role=status` si loading ;
- utiliser Geist Mono ou Geist Pixel ;
- rester optionnels via design tokens.

### Risques
- Retomber dans une DA “hacker cliché”.
- Dégrader l’accessibilité si les frames animées ne sont pas masquées correctement.
- Trop charger les pages principales.
- Copier du code CodePen non maintenable.
- Faire des animations qui consomment trop pour un simple loading state.

### Décision provisoire
Oui à l’esthétique ASCII/Unicode pour les loaders et micro-états contrôlés.
Non à l’ASCII décoratif généralisé.

## 16.12 Inspirations design — DA globale / dashboards / pixel premium
Source : screenshots utilisateur d’inspirations UI : moodboards pixel/Y2K, Susan Kare/Macintosh, ChainGPT Labs dark grid, Global Finances, dashboards crypto/finance, data visualization globe, intelligence/agent dashboards, resource overview, Quantix, Sapphire UI, banking dashboard, white pixel dashboard, industrial monitoring dashboard, Forra.

### Lecture globale
La direction qui émerge n’est pas “full pixel”. C’est plutôt :
- command center premium ;
- finance/data cockpit ;
- dark OS élégant ;
- grille technique discrète ;
- accents pixel/terminal contrôlés ;
- quelques moments visuels wow ;
- information épurée, mais rendu très travaillé.

### Deux pôles d’inspiration à fusionner
1. Pôle créatif pixel / software nostalgia :
   - Susan Kare / Macintosh UI ;
   - pixel typography ;
   - petites icônes ;
   - fenêtres/cadres rétro ;
   - loaders ASCII/terminal ;
   - côté “OS personnel”.

2. Pôle premium finance / command center :
   - dashboards dark très structurés ;
   - cartes denses mais propres ;
   - data visualizations fines ;
   - globe/radar/mémoire ;
   - grilles, lignes, borders, coordonnées ;
   - ambiance cockpit d’analyse.

### Direction DA recommandée
Nom de travail : `Finance-OS Command Pixel`.

Principes :
- base sombre premium graphite/noir ;
- surfaces calmes, borders fines, grilles discrètes ;
- typographie Geist Sans / Mono / Pixel ;
- icônes pixel comme accent, surtout navbar/dropdowns ;
- data viz propre, pas décorative ;
- quelques écrans “wow” : mémoire 3D, radar, login ;
- pages métier très lisibles : cockpit, dépenses, patrimoine, investissements ;
- admin/ops plus terminal/command center ;
- éviter le rose Aurora comme base.

### Ce qu’il faut prendre des inspirations
- Du moodboard pixel/Y2K : texture, petites fenêtres, iconographie, grain, couche créative — pas le chaos.
- Du projet dino/pixel : pictos pixel, expressivité, fun contrôlé — pas le rose massif ni le côté enfantin.
- Du Susan Kare/Macintosh : UI en fenêtres, icônes pixel, simplicité historique — pas le pastiche rétro complet.
- De ChainGPT Labs / Forra : grille noire, mono labels, découpage strict, accents orange/tech, identité forte.
- De Global Finances : finance premium + grand titre pixel + données financières très lisibles.
- Des dashboards dark finance/crypto : surfaces, hiérarchie, chart cards, heatmaps, montants, ratios.
- Des dashboards globe/radar/intelligence : inspiration pour Radar et Mémoire 3D uniquement, pas pour toutes les pages.
- Du Resource Overview : style ops/infra pour Orchestration, Coûts, Santé, runs.
- Des dashboards light pixel : piste secondaire pour mode light ou certaines pages, mais pas direction principale.

### Ce qu’il faut éviter
- Full pixel sur toute l’app.
- Gros titres pixel partout.
- Rose néon / Aurora Pink comme couleur principale.
- Collages visuels permanents.
- Dashboards trop militaires/espionnage pour les pages financières quotidiennes.
- Trop de grilles, cadres, brackets, coordonnées au premier niveau.
- Trop d’effets glow.
- Sidebars lourdes copiées des dashboards inspi.
- Copier des landing pages au lieu de designer une app.

### Mapping par zones produit
- Cockpit : inspiration dashboard finance premium + command center léger, sans hero décoratif.
- Dépenses : minimal data cards + table claire + catégories, peu d’effets.
- Patrimoine : finance premium, chiffres très lisibles, chart calme.
- Investissements : portefeuille lisible façon dashboard crypto premium, mais simplifié.
- Radar : inspiration globe/data visualization, page wow mais minimaliste.
- Mémoire Graph 3D : inspiration intelligence/radar/agent dashboard, plein écran, tooltip propre.
- Orchestration / Coûts / Santé : inspiration Resource Overview / terminal ops, mais accessible.
- Social Intelligence : galerie de sources/comptes avec cards premium et icônes pixel contrôlées.
- Login : peut être plus cinématique/atmosphérique, en gardant le background ReactBits validé.

### Palette provisoire extraite
Base : noir graphite, charbon, gris bleuté sombre, off-white.
Accents possibles : vert signal, cyan froid, orange tech, violet doux, jaune/ambre ponctuel.
À éviter : Aurora Pink comme accent principal. Le rose peut exister seulement en micro-accent très rare si la future palette le justifie, mais pas comme identité centrale.

### Règle de composition
La DA doit être spectaculaire par la précision : spacing, typo, micro-interactions, surfaces, data viz, icon containers, transitions. Pas par accumulation d’éléments.

### Risques
- Trop charger l’app en voulant mixer toutes les inspirations.
- Transformer Finance-OS en art project au lieu d’un outil financier personnel.
- Perdre la lisibilité des chiffres.
- Rendre les pages admin séduisantes mais inutilisables.
- Faire du “dark dashboard générique” sans vraie patte pixel/OS.

### Décision provisoire
Adopter une direction `premium dark command center + pixel accent`, avec Geist, pixel icons, loaders ASCII contrôlés, top navbar premium, surfaces sobres, et quelques pages wow isolées.

## 17. Design Direction v1 — Finance-OS Command Pixel

### 17.1 Positionnement
Finance-OS devient un OS financier personnel premium : une interface de décision, de suivi et d’analyse qui mélange la rigueur d’un cockpit financier, la clarté d’un produit Apple-like, et une patte créative pixel/terminal contrôlée.

Nom de travail : `Finance-OS Command Pixel`.

Promesse visuelle :
- premium ;
- calme ;
- précis ;
- financier ;
- tech ;
- légèrement pixel ;
- jamais brouillon.

### 17.2 Mots-clés DA
À viser :
- dark command center ;
- personal finance OS ;
- premium dashboard ;
- pixel accent ;
- terminal polish ;
- data calm ;
- Apple-like clarity ;
- quiet intelligence ;
- cinematic login ;
- human-readable AI.

À éviter :
- Aurora Pink ;
- full pixel ;
- full terminal ;
- hacker cliché ;
- dashboard militaire partout ;
- SaaS générique ;
- shadcn générique ;
- ReactBits show-off ;
- wording IA ;
- ASCII permanent ;
- bento menu.

### 17.3 Système typographique validé
Police principale : `Geist Sans`.
- UI principale.
- Body.
- Navigation.
- Cards.
- Formulaires.
- Boutons.
- Textes courts.

Police data/tech : `Geist Mono`.
- Montants.
- Tableaux.
- Dates.
- Metadata.
- Statuts admin/ops.
- Runs.
- Coûts.
- Labels techniques courts.

Police accent : `Geist Pixel`.
- Wordmark / logo si pertinent.
- Dropdown labels rares.
- Empty states signature.
- Micro-badges.
- Accents créatifs courts.

Option rare : `Departure Mono`.
- À tester uniquement si Geist Pixel manque de caractère sur certains accents.
- Ne doit pas devenir une quatrième famille visible partout.

Règle : pas plus de 2 familles principales + 1 accent.

### 17.4 Iconographie
Stratégie : premium utility + pixel accent.

Candidats à garder en roadmap :
- shadcn Pixel Icons ;
- pxlkit ;
- pixelarticons ;
- HackerNoon pixel-icon-library ;
- Lucide / Phosphor / Tabler comme fallback utility si nécessaire.

Règle d’usage :
- pixel icons pour navbar, dropdowns, empty states, moments signature ;
- icônes sobres pour actions critiques, formulaires, tableaux, états d’erreur ;
- aucun SVG complexe généré à la main par Codex ;
- créer un composant `NavIconTile` réutilisable.

Composant cible :
- icône 20–24 px ;
- capsule 36–44 px ;
- border fine ;
- fond légèrement texturé ou gradient très discret ;
- accent couleur par section ;
- état hover propre ;
- pas de glow excessif.

### 17.5 Palette provisoire
Base :
- noir graphite ;
- charbon ;
- gris bleuté sombre ;
- off-white chaud ou froid selon DA finale.

Surfaces :
- fond principal très sombre ;
- cards légèrement plus claires ;
- borders faibles mais visibles ;
- grilles très discrètes ;
- overlays/drawers avec profondeur douce.

Accents possibles :
- vert signal pour positif/santé/succès ;
- cyan froid pour data/radar ;
- orange tech pour ops/alerte/action ;
- violet doux pour IA/mémoire ;
- ambre pour attention.

À éviter :
- Aurora Pink comme couleur système ;
- rose massif ;
- néons multiples ;
- gradients décoratifs omniprésents.

### 17.6 Navigation cible
Remplacer la sidebar par une top navbar.

Structure desktop provisoire :
- logo / wordmark Finance-OS ;
- Cockpit ;
- Argent ;
- IA ;
- Radar ;
- Ops ;
- recherche / command palette ;
- mode admin/demo ;
- user menu.

Dropdowns :
- `Argent` : Dépenses, Patrimoine, Investissements, Objectifs.
- `IA` : Advisor, Chat, Mémoire 3D.
- `Radar` : Marchés & signaux, Social Intelligence.
- `Ops` : Orchestration, Coûts, Intégrations, Santé.

Règles dropdown :
- items courts ;
- icône dans capsule ;
- titre + description d’une ligne maximum ;
- pas de wording IA ;
- pas de mega menu marketing ;
- pas de menu trop profond.

Mobile :
- solution à définir après maquettes ;
- recommandation provisoire : bottom nav pour principales pages + drawer secondaire pour admin/ops.

### 17.7 Layout & surfaces
Direction : surfaces premium sobres, pas bento décoratif.

Règles :
- cards lisibles ;
- grands espaces sur pages métier ;
- data dense uniquement quand nécessaire ;
- profondeur douce ;
- bordures nettes ;
- grilles discrètes ;
- effets de texture très subtils ;
- pas de suraccumulation.

Patterns :
- `MetricCard` pour chiffres clés ;
- `DataPanel` pour graphiques ;
- `EntityCard` pour comptes/sources/assets ;
- `OpsRunCard` pour Orchestration ;
- `CostBreakdownCard` pour Coûts ;
- `NavDropdownItem` pour navigation ;
- `StatusPill` pour états simples ;
- `InsightCard` pour recommandations Advisor courtes.

### 17.8 Data viz
Data viz = outil de lecture, pas décor.

Règles :
- montants très lisibles ;
- axes et labels sobres ;
- tooltips human-readable ;
- couleurs fonctionnelles ;
- pas de chart gadget ;
- pas de graph illisible ;
- pas d’animation excessive ;
- jamais de JSON brut.

Styles par zone :
- Cockpit : 1 chart principal maximum.
- Dépenses : catégories + transactions.
- Patrimoine : courbe valeur + répartition.
- Investissements : positions + allocation simplifiée.
- Radar : visualisation plus immersive.
- Mémoire 3D : expérience plein écran / quasi plein écran.
- Ops/Coûts/Santé : heatmaps, timelines, status, runs, breakdown.

### 17.9 Micro-interactions
Objectif : rendre l’app agréable, pas spectaculaire gratuitement.

À utiliser :
- hover subtil ;
- active state précis ;
- transitions courtes ;
- dropdown opening smooth ;
- focus ring visible ;
- skeleton/loaders signature ;
- tooltip propre ;
- chart hover lisible.

À bannir :
- animations longues ;
- parallax ;
- ReactBits hors login ;
- motion décorative non essentielle ;
- glow permanent ;
- mouvement qui gêne la lecture.

Reduced motion obligatoire.

### 17.10 ASCII / terminal loaders
Oui à l’ASCII/Unicode comme micro-état contrôlé.

Composants possibles :
- `TerminalSpinner` ;
- `AsciiBrainLoader` ;
- `LoadingGlyph` ;
- `AsciiFrame`.

Usage :
- IA en réflexion ;
- mémoire 3D qui charge ;
- run Orchestration en cours ;
- coût recalculé ;
- sync en cours ;
- empty state signature.

Interdits :
- ASCII permanent ;
- gros ASCII dans pages métier ;
- ASCII pour remplacer des chiffres ou décisions ;
- animation sans alternative accessible.

### 17.11 Wording
Direction : court, direct, naturel, produit.

À supprimer :
- “Prochaines actions” générique ;
- “Demander à l’Advisor” partout ;
- “lecture simple” ;
- “bruit expert” ;
- formulations IA/corporate ;
- explications internes ;
- jargon GraphRAG / context bundle / confidence model visible.

Règle : Finance-OS ne doit pas commenter tout ce qu’il affiche. Il doit montrer clairement.

### 17.12 Mapping par pages
Cockpit :
- page d’accueil utile ;
- lecture immédiate ;
- pas de hero ReactBits ;
- pas de Prochaines actions ;
- focus : argent disponible, cashflow, patrimoine, alertes réelles.

Dépenses :
- flux clair ;
- top catégories ;
- transactions ;
- catégorisation intelligente ;
- pas de sur-explication.

Patrimoine :
- garder structure ;
- nettoyer wording ;
- grand total + courbe + actifs.

Investissements :
- refonte IA ;
- portefeuille lisible ;
- positions, allocation, valeur, gain/perte ;
- diagnostics cachés.

Objectifs :
- page sobre ;
- pas de hero ;
- pas de ReactBits ;
- objectifs + progression + CTA unique.

IA Chat :
- minimaliste ;
- input clair ;
- pas de panels techniques.

IA Advisor :
- recommandations d’achat/surveillance ;
- conseils dépenses ;
- état financier court ;
- pas de scorecards visibles partout.

Mémoire 3D :
- graph plein écran/quasi plein écran ;
- recherche + filtres ;
- tooltip human-readable ;
- debug Qdrant/Neo4j avant refonte complète.

Radar :
- fusion Signaux/Marchés ;
- wow minimaliste ;
- signaux sélectionnés ;
- pas de flux news complet.

Social Intelligence :
- galerie de comptes suivis ;
- avatar, handle, bio, tags ;
- pas de coûts ni sync visibles.

Orchestration :
- tous les runs manuels ;
- Free Firehose intégré ;
- Twitter/X intégré ;
- historique et statuts.

Coûts :
- coût global ;
- IA, X/Twitter, providers ;
- réel vs estimé vs dry-run ;
- anomalies.

Santé :
- état global clair ;
- providers / fraîcheur / erreurs ;
- pas de page env diagnostics séparée.

Intégrations :
- connexions actives ;
- statut simple ;
- action claire ;
- détails avancés cachés.

Trading Lab :
- hors scope profond ;
- seulement harmonisation visuelle.

Login :
- refaire page ;
- conserver background ReactBits validé ;
- plus premium/cinématique ;
- pas d’effet en trop.

### 17.13 Accessibilité & performance
Non négociable :
- contraste lisible ;
- focus states visibles ;
- navigation clavier ;
- aria-labels sur loaders/spinners ;
- reduced motion ;
- textes courts et compréhensibles ;
- tooltips non essentiels pour comprendre ;
- pas de couleur seule pour transmettre un état.

Performance :
- limiter animations lourdes ;
- lazy-load graph 3D/pages wow ;
- pas de ReactBits hors login ;
- surveiller LCP / INP / CLS ;
- éviter gros assets non optimisés ;
- rendre les pages métier rapides avant d’être spectaculaires.

### 17.14 Design tokens à prévoir
Catégories :
- colors.background ;
- colors.surface ;
- colors.border ;
- colors.text ;
- colors.muted ;
- colors.success ;
- colors.warning ;
- colors.danger ;
- colors.info ;
- colors.ai ;
- colors.ops ;
- radius ;
- shadows ;
- font.family ;
- font.size ;
- spacing ;
- motion.duration ;
- motion.easing ;
- z-index layers.

### 17.15 Décision v1
Direction validée pour la suite :
`Finance-OS Command Pixel` — un OS financier personnel premium, sombre, précis, data-driven, avec une touche pixel/terminal contrôlée.

Cette direction sert de base à la phase suivante : structure du shell, navigation, design tokens, puis maquettes.

## 18. Shell & Navigation v1 — Finance-OS

### 18.1 Objectif du shell
Le shell Finance-OS doit remplacer la sidebar actuelle par une navigation plus premium, plus lisible et mieux organisée.

Objectifs :
- rendre les pages principales accessibles rapidement ;
- séparer clairement utilisateur / IA / admin-ops ;
- réduire le bruit ;
- créer une vraie patte premium + pixel ;
- garder l’app agréable au quotidien ;
- éviter un menu trop profond ou trop marketing.

### 18.2 Structure desktop cible
Desktop = top navbar persistante.

Structure recommandée :
1. Zone gauche : logo / wordmark `Finance-OS`.
2. Zone centrale : navigation principale.
3. Zone droite : recherche globale / command palette, mode admin-demo, statut discret, user menu.

Navigation principale :
- `Cockpit` — lien direct.
- `Argent` — dropdown.
- `IA` — dropdown.
- `Radar` — dropdown ou lien direct selon scope final.
- `Ops` — dropdown admin/ops.

### 18.3 Pourquoi cette structure
- `Cockpit` doit rester accessible en un clic, car c’est la page d’accueil opérationnelle.
- `Argent` regroupe les pages financières métier.
- `IA` regroupe les expériences IA utiles, sans envahir les autres pages.
- `Radar` regroupe la veille externe et les sources sociales.
- `Ops` regroupe les pages techniques/admin : runs, coûts, santé, intégrations.

### 18.4 Dropdown Argent
Intention : gérer et comprendre son argent.

Items :
- `Dépenses` — Transactions, catégories, cashflow.
- `Patrimoine` — Comptes, actifs, valeur globale.
- `Investissements` — Positions, allocation, performance.
- `Objectifs` — Progression, montants cibles, échéances.

Règles :
- wording court ;
- descriptions d’une ligne max ;
- icônes pixel ou utility dans `NavIconTile` ;
- aucun jargon.

### 18.5 Dropdown IA
Intention : parler à l’IA, lire ses recommandations, explorer la mémoire.

Items :
- `Advisor` — Recommandations simples.
- `Chat` — Discussion minimaliste.
- `Mémoire 3D` — Explorer le graph.

Règles :
- pas de GraphRAG visible ;
- pas de payload/context bundle ;
- pas de wording “assistant partout” ;
- IA = espace dédié, pas un CTA permanent sur chaque page.

### 18.6 Dropdown Radar
Intention : voir ce que Finance-OS surveille.

Décision provisoire : choisir ce qui offre la meilleure UX après maquette.

Recommandation actuelle :
- desktop : `Radar` en top-level direct si la page fusionnée Marchés & signaux devient une vraie page forte/wow ;
- dropdown seulement si Social Intelligence doit rester rattachée visuellement à Radar.

Items possibles :
- `Radar` ou `Marchés & signaux` — Vue minimaliste fusionnée.
- `Social Intelligence` — Comptes suivis et sources sociales.

Option préférée à tester :
- `Radar` en lien direct dans la navbar ;
- `Social Intelligence` accessible via Radar page, command palette, ou éventuellement dans un menu secondaire.

### 18.7 Dropdown Ops
Intention : gérer ce qui fait tourner Finance-OS.

Décision utilisateur : Ops doit être visible seulement en mode admin.

Items :
- `Orchestration` — Tous les runs manuels.
- `Coûts` — IA, X/Twitter, providers, réel vs estimé.
- `Intégrations` — Connexions et providers.
- `Santé` — État global app/données.

Règles :
- `Ops` caché hors mode admin ;
- pages Ops accessibles via command palette uniquement si admin ;
- détails techniques cachés dans drawers/collapsibles ;
- pas de pages inutiles : Env Diagnostics, Sources, Free Firehose séparé doivent disparaître.

### 18.8 User menu / mode / statut
Zone droite :
- `⌘K` / search / command palette ;
- badge discret admin/demo ;
- statut simple si utile : OK / attention ;
- user menu : profil, logout, paramètres absorbés si nécessaire.

Décision utilisateur : la page Paramètres doit être absorbée dans le user menu ou supprimée si l’audit confirme qu’elle ne sert à rien.

Paramètres survivants possibles dans user menu :
- mode / profil ;
- apparence si nécessaire ;
- logout ;
- notifications uniquement si réellement fonctionnelles ;
- liens admin uniquement si admin.

### 18.9 Command palette
La command palette devient l’accès rapide expert.

Décision utilisateur : inclure navigation + actions.

Elle doit contenir :
- navigation toutes pages ;
- actions fréquentes ;
- runs admin si admin ;
- recherche transaction / compte / actif plus tard ;
- actions rapides contextuelles si sûres.

Actions candidates :
- lancer une sync Powens ;
- lancer un run Advisor ;
- lancer un run Social/X ;
- ouvrir ajout objectif ;
- ouvrir ajout actif manuel ;
- exporter CSV depuis Dépenses ;
- ouvrir catégorisation des transactions à revoir.

Règles :
- actions destructives avec confirmation ;
- actions coûteuses avec indication si admin/coût ;
- actions Ops visibles uniquement en mode admin ;
- ne pas transformer la command palette en debug panel.

### 18.10 Mobile navigation
Décision : bottom nav exacte à retenir pour la v1.

Bottom nav recommandée :
- `Cockpit` ;
- `Dépenses` ;
- `Patrimoine` ;
- `Advisor` ;
- `More`.

Justification : ces entrées couvrent l’usage quotidien, évitent une navigation abstraite par catégories, et gardent `Advisor` accessible sans envahir toutes les pages.

`More` ouvre un drawer :
- Investissements ;
- Objectifs ;
- Radar ;
- Social Intelligence ;
- Chat ;
- Mémoire 3D ;
- Intégrations ;
- Santé ;
- Ops/admin uniquement si mode admin.

Option alternative rejetée pour l’instant : bottom nav avec `Argent`, `IA`, `Radar`, `Ops`, `More`, car trop abstraite et moins directe pour l’usage quotidien.

### 18.11 Responsive / tablet
Tablet :
- top navbar compacte ;
- dropdowns réduits ;
- command palette toujours accessible ;
- pas de sidebar permanente sauf si écran très large et besoin expert.

Desktop large :
- top navbar ;
- page content max-width selon page ;
- pages immersives comme Graph 3D/Radar peuvent prendre toute la largeur.

### 18.12 Composants shell à prévoir
- `AppShell` ;
- `TopNavbar` ;
- `NavDropdown` ;
- `NavDropdownItem` ;
- `NavIconTile` ;
- `MobileBottomNav` ;
- `MobileMoreDrawer` ;
- `CommandPaletteTrigger` ;
- `UserMenu` ;
- `ModeBadge` ;
- `SystemStatusDot`.

### 18.13 Style navbar
Direction : Factory / Profound / Qatalog, adaptée à Finance-OS.

Desktop :
- hauteur compacte ;
- fond sombre semi-opaque ou surface nette ;
- border-bottom fine ;
- dropdowns en cards premium ;
- hover subtil ;
- icônes pixel contrôlées ;
- descriptions très courtes ;
- active state visible mais calme.

Mobile :
- bottom nav très lisible ;
- labels courts ;
- icônes cohérentes ;
- drawer More propre ;
- pas de hamburger seul comme navigation principale.

### 18.14 Accessibilité navigation
Contraintes :
- navigation clavier complète ;
- focus visible ;
- ESC ferme les dropdowns ;
- clic extérieur ferme les dropdowns ;
- aria-expanded / aria-controls ;
- role adapté selon composants ;
- contraste suffisant ;
- cibles tactiles correctes ;
- reduced motion sur transitions.

### 18.15 Décision Shell v1
Direction validée :
- top navbar desktop ;
- dropdowns groupés par intention ;
- `Radar` à tester comme lien direct si la page devient forte ;
- `Ops` visible uniquement en mode admin ;
- command palette avec navigation + actions ;
- bottom nav mobile exacte : Cockpit, Dépenses, Patrimoine, Advisor, More ;
- Paramètres absorbée dans user menu ou supprimée après audit ;
- pages inutiles supprimées ou absorbées ;
- style premium dark + pixel accent.

## 19. Design Tokens v1 — Finance-OS Command Pixel

### 19.1 Objectif des tokens
Les tokens doivent transformer la DA `Finance-OS Command Pixel` en système stable, maintenable et applicable à toute l’app.

Objectifs :
- remplacer Aurora Pink ;
- éviter les styles hardcodés ;
- garantir cohérence dark/premium ;
- rendre les états financiers lisibles ;
- préparer light mode éventuel sans le prioriser ;
- faciliter refonte design system ;
- garantir accessibilité, contrastes, focus, reduced motion.

### 19.2 Stratégie tokens
Créer une structure en trois niveaux :

1. Primitive tokens
- couleurs brutes ;
- spacing ;
- radius ;
- shadows ;
- typographies ;
- motion.

2. Semantic tokens
- background ;
- surface ;
- text ;
- border ;
- success ;
- warning ;
- danger ;
- info ;
- ai ;
- ops ;
- radar ;
- finance.

3. Component tokens
- navbar ;
- dropdown ;
- card ;
- table ;
- chart ;
- button ;
- badge ;
- input ;
- tooltip ;
- drawer ;
- command palette.

### 19.3 Couleurs — base dark
Base proposée :
- `background.base` : noir graphite très sombre.
- `background.subtle` : charbon bleuté.
- `surface.base` : gris noir premium.
- `surface.raised` : surface légèrement plus claire.
- `surface.overlay` : dropdown/drawer/modal.
- `surface.inset` : zones internes/tableaux.
- `border.subtle` : border faible.
- `border.strong` : border hover/focus.

Direction chromatique :
- pas noir pur partout ;
- pas rose Aurora ;
- surfaces froides/graphiques ;
- légers contrastes bleutés/graphite ;
- grilles et borders discrètes.

### 19.4 Couleurs — texte
Tokens :
- `text.primary` : presque blanc, pas blanc pur agressif.
- `text.secondary` : gris clair.
- `text.muted` : gris bleuté.
- `text.disabled` : gris bas contraste mais lisible.
- `text.inverse` : pour surfaces très claires si besoin.
- `text.mono` : metadata/chiffres.

Règle : les montants et données critiques doivent toujours avoir un contraste fort.

### 19.5 Couleurs — accents sémantiques
Accents proposés :
- `success` : vert signal, santé, positif.
- `danger` : rouge/corail maîtrisé, perte/erreur.
- `warning` : ambre/orange doux, attention.
- `info` : cyan froid, data/radar.
- `ai` : violet doux/électrique contrôlé.
- `ops` : orange tech.
- `finance` : vert/cyan selon contexte.

Règle :
- pas plus de 1 accent dominant par composant ;
- les couleurs servent l’état ou la section, pas la décoration ;
- les charts ont une palette dédiée, pas les mêmes couleurs que les CTA.

### 19.6 Palette de sections
Sections top nav :
- Cockpit : neutre/off-white + signal discret.
- Argent : vert/cyan financier.
- IA : violet doux.
- Radar : cyan/bleu signal.
- Ops : orange/ambre.

Ces couleurs doivent apparaître dans :
- `NavIconTile` ;
- active state ;
- badges ;
- petites lignes d’accent ;
- jamais en grands aplats agressifs.

### 19.7 Radius
Direction : premium logiciel moderne.

Tokens :
- `radius.xs` : 4px ;
- `radius.sm` : 6px ;
- `radius.md` : 10px ;
- `radius.lg` : 14px ;
- `radius.xl` : 18px ;
- `radius.2xl` : 24px ;
- `radius.full` : 999px.

Usage :
- cards : lg/xl ;
- dropdowns : xl ;
- buttons : md/lg ;
- pills : full ;
- icon tiles : md/lg.

### 19.8 Borders
Tokens :
- `border.subtle` ;
- `border.default` ;
- `border.hover` ;
- `border.active` ;
- `border.focus` ;
- `border.danger` ;
- `border.warning` ;
- `border.success`.

Style :
- 1px très précis ;
- inset borders possibles ;
- pas de grosses bordures pixel partout ;
- micro-border pixel seulement dans certains accents.

### 19.9 Shadows / elevation
Direction : profondeur douce, pas glassmorphism excessif.

Tokens :
- `shadow.none` ;
- `shadow.sm` ;
- `shadow.md` ;
- `shadow.lg` ;
- `shadow.dropdown` ;
- `shadow.modal` ;
- `shadow.glow-subtle` ;
- `shadow.focus-ring`.

Règle :
- pas de glow permanent ;
- glow uniquement hover/focus/signal fort ;
- surfaces dark = borders + contrastes avant shadows.

### 19.10 Spacing
Base spacing : multiples de 4px.

Tokens :
- 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64.

Règles :
- pages métier : plus d’air, moins de blocs ;
- dashboards : grille régulière ;
- navbar/dropdowns : densité premium mais respirante ;
- mobile : cibles tactiles généreuses.

### 19.11 Typographie tokens
Familles :
- `font.sans` : Geist Sans.
- `font.mono` : Geist Mono.
- `font.pixel` : Geist Pixel.
- `font.accent-alt` : Departure Mono optionnel.

Échelles :
- `text.xs` : metadata, labels.
- `text.sm` : descriptions courtes.
- `text.base` : body.
- `text.lg` : section headings.
- `text.xl` : card headings.
- `text.2xl/3xl` : page titles.
- `text.display` : grands montants / hero login seulement.

Règles :
- montants majeurs en Geist Mono ou Sans selon lisibilité ;
- labels techniques en Mono ;
- Pixel uniquement sur courts accents ;
- jamais Geist Pixel pour paragraphes ou tables.

### 19.12 Motion tokens
Objectif : micro-interactions rapides, propres, accessibles.

Durées :
- `motion.instant` : 80ms ;
- `motion.fast` : 120ms ;
- `motion.normal` : 180ms ;
- `motion.slow` : 260ms ;
- `motion.page` : 320ms max.

Easings :
- `ease.out` ;
- `ease.inOut` ;
- `ease.spring-subtle` si maîtrisé.

Règles :
- reduced motion obligatoire ;
- pas de parallaxe ;
- pas d’animations longues sur pages métier ;
- dropdowns et hover doivent être rapides ;
- loaders ASCII doivent pouvoir être stoppés/simplifiés.

### 19.13 Focus / accessibility tokens
Tokens :
- `focus.ring.color` ;
- `focus.ring.width` ;
- `focus.ring.offset` ;
- `focus.ring.shadow`.

Règles :
- focus visible partout ;
- contraste focus suffisant ;
- pas de suppression de outline sans remplacement ;
- états hover/focus/active distincts ;
- pas de couleur seule pour indiquer erreur/succès.

### 19.14 Component tokens prioritaires
Navbar :
- height ;
- background ;
- border ;
- item hover ;
- item active ;
- dropdown background ;
- dropdown shadow ;
- icon tile background.

Cards :
- background ;
- border ;
- radius ;
- padding ;
- title color ;
- muted text ;
- hover.

Buttons :
- primary ;
- secondary ;
- ghost ;
- danger ;
- icon ;
- focus.

Badges/Pills :
- success ;
- warning ;
- danger ;
- info ;
- ai ;
- ops ;
- demo ;
- admin.

Tables :
- header ;
- row ;
- row hover ;
- border ;
- amount positive/negative ;
- muted columns.

Charts :
- axis ;
- grid ;
- tooltip ;
- positive ;
- negative ;
- neutral ;
- categorical palette.

### 19.15 Data viz palette v1
Principes :
- couleurs accessibles ;
- pas trop saturées ;
- lisibles sur fond dark ;
- série principale claire ;
- positif/négatif distincts ;
- palettes catégorielles limitées.

À prévoir :
- `chart.line.primary` ;
- `chart.line.secondary` ;
- `chart.grid` ;
- `chart.axis` ;
- `chart.tooltip.bg` ;
- `chart.positive` ;
- `chart.negative` ;
- `chart.warning` ;
- `chart.category.1..8`.

### 19.16 Light mode
Light mode non prioritaire.

Règle :
- ne pas le casser si déjà existant ;
- mais design d’abord dark ;
- tokens doivent permettre un futur light mode propre ;
- ne pas concevoir la DA autour du light mode pour l’instant.

### 19.17 Nommage recommandé
Adopter un modèle sémantique proche :
- `--fos-bg-base` ;
- `--fos-bg-subtle` ;
- `--fos-surface-base` ;
- `--fos-surface-raised` ;
- `--fos-border-subtle` ;
- `--fos-text-primary` ;
- `--fos-accent-ai` ;
- `--fos-accent-ops` ;
- `--fos-accent-radar` ;
- `--fos-success` ;
- `--fos-warning` ;
- `--fos-danger`.

Ne pas exposer directement `pink`, `blue`, `green` partout dans les composants.

### 19.18 Décision Tokens v1
Tokens v1 validés conceptuellement :
- dark-first ;
- OKLCH compatible ;
- sémantiques avant couleurs brutes ;
- Geist comme système typo ;
- accents par section ;
- focus/accessibilité intégrés ;
- motion réduite et maîtrisée ;
- no Aurora Pink.

Ces tokens serviront de base à la future phase maquette et au design system.

## 20. Component System v1 — Finance-OS Command Pixel

### 20.1 Objectif
Le component system v1 définit les briques UI à concevoir avant les maquettes et avant les prompts d’implémentation.

Objectifs :
- éviter une refonte page par page incohérente ;
- réduire les composants monolithiques ;
- sortir du style Aurora Pink/ReactBits ;
- construire une base premium, accessible, maintenable ;
- permettre une UI spectaculaire par cohérence, pas par accumulation.

### 20.2 Principe général
Chaque composant doit avoir :
- une intention claire ;
- des variantes limitées ;
- des états explicites : default, hover, active, focus, disabled, loading, error ;
- un comportement clavier ;
- des tokens propres ;
- un usage documenté ;
- une version mobile correcte.

Règle : pas de composant décoratif sans utilité produit.

### 20.3 Shell components
Composants :
- `AppShell` ;
- `TopNavbar` ;
- `NavDropdown` ;
- `NavDropdownItem` ;
- `NavIconTile` ;
- `MobileBottomNav` ;
- `MobileMoreDrawer` ;
- `CommandPaletteTrigger` ;
- `CommandPalette` ;
- `UserMenu` ;
- `ModeBadge` ;
- `SystemStatusDot`.

Rôle :
- remplacer la sidebar ;
- clarifier Argent / IA / Radar / Ops ;
- rendre la navigation premium et accessible ;
- isoler Ops en mode admin.

Contraintes :
- keyboard navigation ;
- ESC/outside click ;
- aria-expanded/aria-controls si applicable ;
- focus visible ;
- reduced motion.

### 20.4 Surface components
Composants :
- `Surface` ;
- `Panel` ;
- `Card` ;
- `MetricCard` ;
- `DataPanel` ;
- `EntityCard` ;
- `InsightCard` ;
- `OpsRunCard` ;
- `CostBreakdownCard` ;
- `ProviderCard` ;
- `AccountCard` ;
- `AssetCard` ;
- `GoalCard`.

Rôle :
- remplacer les surfaces hétérogènes actuelles ;
- standardiser les layouts ;
- créer une profondeur premium ;
- rendre les pages plus faciles à scanner.

Règles :
- pas de bento décoratif ;
- cards utilisées pour structurer, pas remplir ;
- titre court ;
- metadata secondaire ;
- action optionnelle ;
- état empty/loading/error standard.

### 20.5 Data display components
Composants :
- `Amount` ;
- `CurrencyAmount` ;
- `PercentChange` ;
- `DateTime` ;
- `FreshnessLabel` ;
- `StatusPill` ;
- `RiskPill` ;
- `ProviderStatus` ;
- `CategoryPill` ;
- `TrendIndicator` ;
- `BreakdownList` ;
- `TopList` ;
- `MiniSparkline`.

Rôle :
- fiabiliser l’affichage des données financières ;
- éviter chaque page avec ses propres formats ;
- rendre positif/négatif/neutral cohérent.

Contraintes :
- ne pas transmettre un état par la couleur seule ;
- formatage localisé ;
- montants très lisibles ;
- pas de jargon technique.

### 20.6 Table components
Composants :
- `DataTable` ;
- `TransactionsTable` ;
- `PositionsTable` ;
- `RunsTable` ;
- `CostsTable` ;
- `SortableHeader` ;
- `TableToolbar` ;
- `TableEmptyState` ;
- `TableSkeleton`.

Rôle :
- standardiser transactions, positions, coûts, runs ;
- améliorer lisibilité ;
- préparer responsive.

Règles :
- colonnes prioritaires ;
- actions alignées ;
- row hover subtil ;
- focus row/action visible ;
- sticky header si utile ;
- responsive en cards sur mobile si nécessaire.

### 20.7 Form & interaction components
Composants :
- `Button` ;
- `IconButton` ;
- `Input` ;
- `Select` ;
- `Combobox` ;
- `Textarea` ;
- `Switch` ;
- `Tabs` ;
- `SegmentedControl` ;
- `Dialog` ;
- `Drawer` ;
- `Tooltip` ;
- `Popover` ;
- `ConfirmDialog`.

Rôle :
- éviter les interactions ad hoc ;
- rendre les actions cohérentes ;
- sécuriser les actions coûteuses/destructives.

Contraintes :
- `IconButton` toujours avec label accessible ;
- actions destructives avec confirmation ;
- actions coûteuses avec indication claire ;
- menu/dropdown/dialog conforme aux patterns clavier.

### 20.8 Feedback components
Composants :
- `EmptyState` ;
- `ErrorState` ;
- `DegradedState` ;
- `LoadingState` ;
- `Skeleton` ;
- `TerminalSpinner` ;
- `AsciiBrainLoader` ;
- `Toast` ;
- `InlineAlert` ;
- `WidgetError` ;
- `WidgetDegraded`.

Rôle :
- clarifier les états de données ;
- remplacer les messages techniques ;
- rendre les chargements plus signature sans être lourds.

Règles :
- jamais de JSON brut ;
- messages courts ;
- action claire si nécessaire ;
- `role=status` pour loading si pertinent ;
- `aria-live` prudent ;
- reduced motion.

### 20.9 Chart & visualization components
Composants :
- `ChartCard` ;
- `LineChart` ;
- `AreaChart` ;
- `BarChart` ;
- `DonutBreakdown` ;
- `AllocationChart` ;
- `Sparkline` ;
- `ChartTooltip` ;
- `ChartLegend` ;
- `RadarScene` ;
- `MemoryGraphScene`.

Rôle :
- rendre les données lisibles ;
- séparer charts métier et scènes wow ;
- éviter les graphes gadget.

Contraintes :
- tooltips lisibles ;
- labels humains ;
- alternative accessible ou résumé textuel ;
- lazy-load pour scènes lourdes ;
- pas de chart décoratif sur les pages métier.

### 20.10 AI components
Composants :
- `AdvisorRecommendationCard` ;
- `AdvisorSummary` ;
- `AdvisorAssetRecommendation` ;
- `ChatShell` ;
- `ChatMessage` ;
- `ChatInput` ;
- `MemoryNodeTooltip` ;
- `MemoryGraphControls` ;
- `SourceConfidencePill` si nécessaire.

Rôle :
- rendre l’IA simple, utile, humaine ;
- supprimer le bruit technique ;
- éviter le vocabulaire GraphRAG visible.

Règles :
- pas de scorecards partout ;
- pas de JSON ;
- pas de context bundle ;
- pas de confidence high/medium/low brut ;
- recommandation = actif, action, montant/valeur, raison courte, risque.

### 20.11 Ops components
Composants :
- `RunCard` ;
- `RunHistoryList` ;
- `RunStatusPill` ;
- `RunActionButton` ;
- `CostSummaryCard` ;
- `CostSourceBreakdown` ;
- `CostAnomalyAlert` ;
- `ProviderHealthCard` ;
- `SyncStatusCard`.

Rôle :
- centraliser ce qui polluait les autres pages ;
- rendre Orchestration/Coûts/Santé propres ;
- garder l’ops lisible mais non envahissant.

Règles :
- Ops visible admin uniquement ;
- actions coûteuses explicites ;
- historique en drilldown ;
- détails techniques cachés.

### 20.12 Icon components
Composants :
- `NavIconTile` ;
- `PixelIcon` ;
- `UtilityIcon` ;
- `ProviderLogo` ;
- `StatusGlyph`.

Rôle :
- contrôler l’usage des icônes pixel ;
- éviter le mélange incohérent ;
- permettre une patte visuelle premium.

Règles :
- pixel icons surtout navigation/signature ;
- utility icons pour actions critiques ;
- logos provider avec fallback ;
- tailles et strokes normalisés.

### 20.13 Page-level templates
Templates :
- `DashboardPageTemplate` ;
- `DataTablePageTemplate` ;
- `EntityGridPageTemplate` ;
- `OpsPageTemplate` ;
- `AiPageTemplate` ;
- `ImmersivePageTemplate` ;
- `AuthPageTemplate`.

Mapping :
- Cockpit : `DashboardPageTemplate`.
- Dépenses : `DataTablePageTemplate`.
- Patrimoine : `DashboardPageTemplate`.
- Investissements : `DashboardPageTemplate` + `DataTablePageTemplate`.
- Social Intelligence : `EntityGridPageTemplate`.
- Orchestration/Coûts/Santé : `OpsPageTemplate`.
- Chat/Advisor : `AiPageTemplate`.
- Radar/Mémoire 3D : `ImmersivePageTemplate`.
- Login : `AuthPageTemplate`.

### 20.14 Component migration strategy
Priorités :
1. Shell/navigation components.
2. Core surfaces/cards.
3. Data display primitives.
4. Feedback states.
5. Tables.
6. Ops components.
7. AI components.
8. Charts/scenes.
9. Page templates.

Règle : migrer progressivement, sans gros big bang tant que debug/runs/coûts/memory ne sont pas stabilisés.

### 20.15 Packages / placement
Objectif : remonter les composants réutilisables dans `packages/ui` quand ils sont stables.

À garder probablement dans `apps/web` au début :
- composants très spécifiques Finance-OS ;
- pages expérimentales ;
- graph 3D ;
- radar ;
- Trading Lab.

À remonter dans `packages/ui` :
- Button/Input/Badge/Card ;
- surface primitives ;
- loading/error/empty states ;
- navigation primitives si génériques ;
- table primitives ;
- typography/amount primitives.

### 20.16 Règles qualité
Chaque composant v1 doit être testé contre :
- lisibilité dark mode ;
- focus visible ;
- clavier ;
- reduced motion ;
- mobile ;
- empty/loading/error ;
- usage avec vraies données longues ;
- pas de dépendance ReactBits ;
- pas de style hardcodé hors tokens.

### 20.17 Décision Component System v1
Le component system cible est validé conceptuellement :
- shell premium top nav ;
- cards/surfaces sobres ;
- data primitives fiables ;
- ops isolé ;
- IA simplifiée ;
- pixel icons contrôlées ;
- ASCII loaders contrôlés ;
- composants accessibles et tokenisés.

Ce système servira de base aux maquettes et à la future découpe en prompts.

## 21. Page Blueprint v1 — Mapping final des pages

### 21.1 Objectif
Le blueprint page par page transforme les décisions UI/UX en structure exploitable pour la phase design, puis pour les prompts d’implémentation.

Règles générales :
- une page = une intention principale ;
- les pages utilisateur montrent les résultats, pas les tuyaux techniques ;
- coûts, syncs, runs, diagnostics vont dans Ops ;
- pas de bloc générique “Prochaines actions” ;
- pas de CTA “Demander à l’Advisor” partout ;
- pas de wording IA/corporate ;
- pas de ReactBits hors login background ;
- pas de JSON brut ;
- pages admin visibles uniquement en mode admin.

### 21.2 Cockpit
Statut : refonte profonde.

Template : `DashboardPageTemplate`.

Intention : comprendre en quelques secondes où est l’argent, ce qui a bougé, ce qui mérite attention, et si les données sont fiables.

Premier niveau :
- disponible maintenant ;
- comptes courants : Fortuneo, Revolut, total ;
- gagné/perdu sur période ;
- épargne ;
- investissements ;
- top dépenses ;
- objectifs ;
- santé très discrète des données/providers.

À supprimer :
- hero ReactBits / Liquid Ether ;
- wording IA ;
- Prochaines actions ;
- synthèse Advisor visible ;
- footer cockpit.

### 21.3 Dépenses
Statut : refonte moyenne, nettoyage fort.

Template : `DataTablePageTemplate`.

Intention : comprendre où part l’argent et corriger les catégories.

Premier niveau :
- période ;
- export CSV ;
- structure par catégories ;
- top dépenses ;
- table transactions ;
- transactions sans catégorie si utile.

À supprimer :
- projection fin de mois ;
- Prochaines actions ;
- Advisor ;
- wording “tes flux en clair” ;
- explications longues.

À ajouter plus tard :
- apprentissage des corrections de catégorisation.

### 21.4 Patrimoine
Statut : conserver structure, nettoyer wording.

Template : `DashboardPageTemplate`.

Intention : comprendre valeur globale, évolution, répartition et actifs.

Premier niveau :
- patrimoine net ;
- évolution ;
- répartition liquidités/investissements/manuel ;
- soldes par connexion ;
- actifs détaillés ;
- investissements externes ;
- actifs manuels admin si pertinent.

À changer :
- wording plus court ;
- zones admin moins visibles.

### 21.5 Investissements
Statut : refonte d’architecture d’information P0.

Template : `DashboardPageTemplate` + `DataTablePageTemplate`.

Intention : comprendre le portefeuille investi.

Premier niveau :
- valeur totale investie ;
- gain/perte ;
- répartition par provider ;
- répartition par type ;
- positions principales ;
- alertes de données seulement si bloquantes.

À déplacer :
- benchmark ;
- diagnostics qualité ;
- coûts inconnus ;
- details provider ;
- confidence/read-only/fraîcheur technique.

Destination : drawer détails ou admin/debug.

### 21.6 Objectifs
Statut : page conservée, nettoyage fort.

Template : `EntityGridPageTemplate` ou `DashboardPageTemplate` léger.

Intention : suivre et gérer les objectifs.

Premier niveau :
- liste/grille d’objectifs ;
- progression ;
- montant actuel/cible ;
- échéance ;
- CTA “Ajouter un objectif”.

À supprimer :
- hero ReactBits / Antigravity ;
- Prochaines actions ;
- CTA Advisor.

### 21.7 IA Chat
Statut : simplification radicale.

Template : `AiPageTemplate`.

Intention : discuter simplement avec l’IA.

Premier niveau :
- historique conversation ;
- input ;
- suggestions discrètes si utiles.

À supprimer :
- panels techniques ;
- contexte affiché en permanence ;
- scores/modèles/payloads ;
- jargon IA.

### 21.8 IA Advisor
Statut : refonte profonde.

Template : `AiPageTemplate`.

Intention : obtenir des recommandations financières simples.

Premier niveau :
- actifs/ETF/crypto à acheter ou surveiller ;
- montant/valeur conseillée ;
- raison courte ;
- risque ;
- conseil dépenses ;
- état financier court.

À supprimer :
- scorecards visibles partout ;
- détails de raisonnement ;
- context bundle ;
- jargon.

### 21.9 Mémoire 3D
Statut : expérience wow + debug obligatoire avant refonte complète.

Template : `ImmersivePageTemplate`.

Intention : explorer la mémoire Finance-OS visuellement.

Premier niveau :
- graph 3D quasi plein écran ;
- recherche ;
- filtres ;
- tooltip lisible.

À supprimer :
- panneaux secondaires inutiles ;
- debug ;
- JSON brut ;
- jargon GraphRAG visible.

Bug : tooltip ne doit jamais afficher de payload JSON. Mapper les nodes vers `title`, `kindLabel`, `summary`, `sourceLabel`, `freshness`, `confidence` si utile.

Debug : vérifier pourquoi le graph affiche surtout des hypothèses.

### 21.10 Radar / Marchés & Signaux
Statut : fusion/simplification forte.

Template : `ImmersivePageTemplate` ou `DashboardPageTemplate` cinématique.

Intention : voir ce que Finance-OS surveille pour nourrir l’Advisor.

Premier niveau :
- marchés clés ;
- 3 à 5 signaux sélectionnés ;
- fraîcheur globale ;
- mention discrète “alimente l’Advisor”.

À supprimer :
- page news actuelle ;
- flux exhaustif ;
- détails providers ;
- ingestion/fetch/logs.

Pipelines de fetch à conserver absolument.

### 21.11 Social Intelligence
Statut : conserver, transformer.

Template : `EntityGridPageTemplate`.

Intention : voir les comptes suivis qui alimentent l’intelligence sociale.

Premier niveau :
- cards comptes ;
- avatar ;
- nom ;
- handle ;
- bio ;
- source ;
- tags/sujets ;
- statut discret.

À supprimer/déplacer :
- coût ;
- sync ;
- logs ;
- diagnostics provider.

Destination : Coûts / Orchestration / Santé.

### 21.12 Orchestration
Statut : page admin centrale à renforcer.

Template : `OpsPageTemplate`.

Intention : lancer et suivre tous les runs manuels.

Premier niveau :
- dernier run global ;
- cards de runs manuels ;
- Free Firehose ;
- X/Twitter ;
- Social ;
- News ;
- Marchés ;
- Powens ;
- External investments ;
- Advisor ;
- Memory graph ;
- historique récent.

À intégrer : page Free Firehose séparée.

Visible admin uniquement.

### 21.13 Coûts
Statut : transformer Coût IA en Coûts globale.

Template : `OpsPageTemplate`.

Intention : comprendre tout ce qui coûte de l’argent.

Premier niveau :
- total jour/semaine/mois ;
- breakdown IA ;
- X/Twitter ;
- embeddings ;
- enrichissement LLM ;
- providers ;
- réel vs estimé vs dry-run ;
- anomalies.

Debug : vérifier le cas 2 × 8 € en 3 jours pour X/Twitter/Social.

Visible admin uniquement.

### 21.14 Intégrations
Statut : garder, simplifier.

Template : `EntityGridPageTemplate` ou `OpsPageTemplate` léger.

Intention : voir quelles connexions sont actives et quoi faire si problème.

Premier niveau :
- provider cards ;
- statut ;
- dernière sync ;
- action principale : connecter/reconnecter/synchroniser.

À déplacer : logs, coûts, runs, diagnostics avancés.

### 21.15 Santé
Statut : garder, simplifier.

Template : `OpsPageTemplate` léger.

Intention : savoir si app/données/providers vont bien.

Premier niveau :
- état global ;
- fraîcheur données ;
- providers OK/attention/erreur ;
- alertes actionnables ;
- lien vers Orchestration/Intégrations si besoin.

À supprimer : PixelBlast/ReactBits, Env Diagnostics séparée, monitoring exhaustif en premier niveau.

### 21.16 Login
Statut : refaire visuellement, conserver background ReactBits.

Template : `AuthPageTemplate`.

Intention : accès premium/cinématique.

À garder : background ReactBits actuel.

À refaire : layout, card login, wording, branding, micro-interactions.

### 21.17 Trading Lab
Statut : hors scope profond.

Action : seulement harmonisation visuelle globale tokens/shell/typo si nécessaire.

À ne pas toucher : logique, stratégies, backtests, architecture data, fonctionnalités.

### 21.18 Pages à supprimer / absorber
Supprimer ou retirer de l’expérience visible :
- Fiscalité ;
- Sources ;
- Free Firehose comme page dédiée ;
- Env Diagnostics ;
- Paramètres si audit confirme inutilité ;
- Signaux/news dans sa forme actuelle.

Conserver les pipelines utiles à l’IA et aux providers.

## 22. Debug & Cleanup Roadmap — Avant maquettes finales / prompts d’implémentation

### 22.1 Objectif
Avant de produire les prompts d’implémentation, stabiliser les problèmes qui faussent le produit : runs trop fréquents, coûts suspects, mémoire Qdrant/Neo4j incertaine, catégorisation non apprenante, pages mortes.

Ces phases peuvent être faites avant ou en parallèle des maquettes, mais doivent être traitées avant une implémentation massive.

### 22.2 ROUTES-CLEANUP-0 — Audit suppressions et routes mortes
Objectif : vérifier et préparer les suppressions sans casser le produit.

À auditer :
- Fiscalité ;
- Sources ;
- Free Firehose page ;
- Env Diagnostics ;
- Paramètres ;
- ReactBits hors login ;
- composants dashboard morts ;
- routes redirects/stubs.

Checks :
- imports ;
- nav ;
- command palette ;
- tests ;
- docs ;
- API calls ;
- workers ;
- shared code.

Sortie attendue : rapport suppression + liste fichiers à `git rm` + risques + checks.

### 22.3 RUNS-0 — Audit fréquence jobs / triggers / retries
Objectif : comprendre pourquoi des runs semblent se lancer trop souvent.

À auditer :
- cron jobs ;
- worker schedules ;
- manual triggers ;
- auto-sync ;
- retries ;
- queue ;
- locks Redis ;
- idempotency keys ;
- dry-run vs real-run ;
- double triggers UI/API ;
- runs X/Twitter/Social ;
- Free Firehose ;
- Powens sync ;
- Advisor refresh ;
- memory ingestion.

Sortie attendue : fréquence réelle, fréquence attendue, anomalies, doublons, coûts potentiels, plan de correction.

### 22.4 COSTS-0 — Audit coûts globaux
Objectif : transformer “Coût IA” en système fiable de suivi des coûts.

À auditer :
- X/Twitter/Social : cas 2 × 8 € en 3 jours ;
- IA Advisor ;
- LLM enrichment ;
- embeddings ;
- providers payants ;
- cost ledger ;
- conversion devise ;
- coûts réels vs estimés vs dry-run ;
- retries ;
- doublons ;
- runId absent.

Sortie attendue : modèle coût clarifié, anomalies, champs nécessaires, migration éventuelle non destructive, UI Coûts cible.

### 22.5 MEMORY-0 — Debug Qdrant / Neo4j / knowledge-service
Objectif : vérifier que la mémoire graph/vector fonctionne vraiment.

À auditer :
- santé Neo4j ;
- santé Qdrant ;
- collections Qdrant ;
- nombre de points ;
- payloads redacted ;
- labels/types Neo4j ;
- relations Neo4j ;
- jobs ingestion ;
- fallback déterministe ;
- endpoint graph ;
- DTO frontend ;
- filtres frontend ;
- diversité des nodes.

Problème observé : le graph semble afficher surtout des hypothèses.

Sortie attendue : rapport chaîne source → ingestion → Neo4j/Qdrant → API → frontend, bugs, corrections, données attendues.

### 22.6 CATEGORIZATION-0 — Apprentissage catégorisation dépenses
Objectif : quand l’utilisateur corrige une catégorie, Finance-OS doit apprendre.

Approche : hybride.
- base déterministe : règles merchant/libellé/montant/compte ;
- complément IA : apprentissage depuis corrections manuelles ;
- priorité : explicabilité, coût bas, fiabilité.

À concevoir :
- modèle `user_categorization_rule` ou équivalent ;
- normalisation merchant ;
- confidence ;
- historique correction ;
- application sur futures transactions ;
- override utilisateur ;
- feedback loop IA.

Sortie attendue : spec technique + UX de correction + règles de sécurité.

### 22.7 UI-A11Y-PERF-0 — Baseline qualité avant refonte
Objectif : mesurer avant/après.

À mesurer :
- Lighthouse ou équivalent ;
- Core Web Vitals : LCP, INP, CLS ;
- axe/a11y si disponible ;
- navigation clavier ;
- reduced motion ;
- bundle heavy imports ;
- pages 3D/charts ;
- mobile.

Sortie attendue : baseline avant refonte + seuils de non-régression.

## 23. Roadmap suivante — Design, maquettes, prompts

### 23.1 Étape A — Finaliser brief design
Le présent brief devient la base de vérité.

À confirmer ensuite :
- palette OKLCH exacte ;
- icon set final : shadcn Pixel vs pxlkit vs pixelarticons ;
- Radar direct ou dropdown après maquettes ;
- Paramètres supprimée ou user menu ;
- composants à prototyper en premier.

### 23.2 Étape B — Maquettes Claude Design / Stitch
Objectif : produire des maquettes sur la base du brief, pas inventer une nouvelle DA.

Maquettes prioritaires :
1. Shell / top navbar / dropdowns / mobile nav.
2. Cockpit.
3. Dépenses.
4. Patrimoine.
5. Investissements.
6. Advisor.
7. Chat.
8. Mémoire 3D.
9. Radar.
10. Social Intelligence.
11. Orchestration / Coûts / Santé.
12. Login.

Règle : ne pas maquetter Trading Lab en profondeur.

### 23.3 Étape C — Critique et sélection
Comparer les maquettes contre :
- clarté ;
- DA Command Pixel ;
- accessibilité ;
- ergonomie ;
- lisibilité data ;
- sobriété ;
- performance probable ;
- faisabilité Codex.

### 23.4 Étape D — Découpage en prompts d’implémentation
Ne pas faire un seul énorme prompt.

Découpage recommandé :
1. Debug ROUTES-CLEANUP-0.
2. Debug RUNS-0.
3. Debug COSTS-0.
4. Debug MEMORY-0.
5. Debug CATEGORIZATION-0.
6. Foundations : tokens + fonts + remove Aurora Pink.
7. Remove ReactBits except login background.
8. Shell/top navbar/mobile nav/command palette.
9. Core components : surfaces, cards, buttons, badges, data primitives.
10. Ops pages : Orchestration, Coûts, Santé, Intégrations.
11. Pages argent : Cockpit, Dépenses, Patrimoine, Investissements, Objectifs.
12. IA pages : Chat, Advisor, Mémoire Graph.
13. Radar + Social Intelligence.
14. Login redesign.
15. QA a11y/perf/responsive/visual polish.
16. Documentation finale.

### 23.5 Étape E — QA finale
Checks :
- lint ;
- typecheck ;
- tests ciblés ;
- build ;
- a11y ;
- keyboard nav ;
- reduced motion ;
- mobile ;
- dark mode ;
- perf pages clés ;
- no ReactBits except login ;
- no Aurora Pink hardcoded ;
- no JSON brut ;
- no pages supprimées en nav.

## 24. Handoff — Résumé à donner à une nouvelle session

Finance-OS fait une refonte UI/UX majeure. Direction validée : `Finance-OS Command Pixel`, un OS financier personnel premium, dark-first, Apple-like dans la clarté, data-driven, avec accent pixel/terminal contrôlé.

Décisions fortes :
- supprimer Aurora Pink ;
- supprimer ReactBits partout sauf background login ;
- remplacer sidebar par top navbar ;
- mobile bottom nav : Cockpit, Dépenses, Patrimoine, Advisor, More ;
- Ops visible seulement admin ;
- command palette = navigation + actions ;
- Geist Sans / Mono / Pixel ;
- pixel icons comme accent : shadcn Pixel, pxlkit, pixelarticons, HackerNoon en candidats ;
- ASCII/Unicode seulement pour loaders/micro-états ;
- supprimer wording IA/corporate ;
- supprimer “Prochaines actions” ;
- pages techniques visibles à retirer ou déplacer en Ops ;
- pas de prompts d’implémentation avant debug + maquettes.

Pages :
- Cockpit refonte profonde ;
- Dépenses nettoyage fort ;
- Patrimoine wording seulement ;
- Investissements refonte IA P0 ;
- Objectifs garder mais supprimer hero/ReactBits ;
- IA = Chat minimaliste + Advisor simple + Mémoire 3D ;
- Radar = fusion Signaux/Marchés minimaliste ;
- Social Intelligence = galerie comptes suivis ;
- Orchestration = tous les runs manuels ;
- Coûts = tous les coûts mesurables ;
- Santé = état global clair ;
- Intégrations = connexions simples ;
- Trading Lab hors scope profond ;
- Fiscalité, Sources, Env Diagnostics, Free Firehose séparé, Signaux/news actuel à supprimer/absorber ;
- Paramètres à absorber dans user menu ou supprimer.

Debugs obligatoires : ROUTES-CLEANUP-0, RUNS-0, COSTS-0, MEMORY-0, CATEGORIZATION-0, UI-A11Y-PERF-0.

Suite : maquettes Claude Design/Stitch, sélection, puis découpage en plusieurs prompts Codex/Claude.

---

## 25. Update 2026-06-03 — État réel du chantier

### 25.1 Décision de séquencement mise à jour

Le chantier ne passe pas encore directement aux maquettes.

Le nouvel ordre validé est :

1. **Finaliser / déployer / valider le patch `PRE-MAQUETTES-FOLLOWUP-VALIDATION-0`** si ce n’est pas déjà fait.
2. **ASSET-VALUATION-0** — priorité produit absolue avant maquettes.
3. **UI-CLEANUP-CONTENT-MAP-0** — nettoyer l’UI, retirer le bruit et produire un rapport page par page.
4. **MAQUETTES-HANDOFF-0** — préparer les prompts Claude Design / Stitch sur une base saine.
5. **UI-REFONTE-IMPLEMENTATION-0** — implémentation progressive des maquettes sélectionnées.
6. **QA finale** — accessibilité, performance, responsive, reduced motion, dark mode, no ReactBits hors login, no JSON brut.

Raison du changement : les maquettes seraient biaisées si les pages Patrimoine / Investissements / Cockpit / Advisor affichent des actifs sans valeur, des montants à `0`, des états de valorisation inconnus ou des données financières inutilisables.

### 25.2 Statut des phases déjà traitées

| Phase | Statut | Commentaire |
|---|---:|---|
| CI-0 | Terminé | CI/lint/typecheck/build ont été stabilisés lors des passes précédentes. |
| VPS-0 / Runtime hardening | Terminé | Swap, limites Docker, log rotation, tuning Redis/Neo4j/Postgres, mémoire et containers validés. |
| RUNS-0 backend | Terminé pour P0/P1 | Advisor ne crash plus sur `.toFixed`; plus de `ai_run` actif stale; external sync dédoublée; stale recovery free_firehose/signal validée. |
| COSTS-0 fondation | Implémenté, à valider prod | Table `recurring_provider_cost`, endpoint `/dashboard/costs/overview`, distinction actual/estimated/fixed ajoutées. Seed `2×8€` à valider. |
| MEMORY-0 fondation | Implémenté, à valider prod | Endpoints `knowledge/storage/status`, `knowledge/storage/ensure`, `/ops/knowledge/enrichment/status`. Qdrant/Neo4j peuvent être vides tant qu’aucun ingest n’a tourné. |
| CATEGORIZATION-0 fondation | Implémenté, à valider prod | Table `user_categorization_rule`, routes list/create/dry-run, moteur de règles avec priorité. |
| Ops status/recovery | Implémenté, à valider prod | Cause racine trouvée : child steps `ai_manual_operation_step` restaient `running` sous parent terminal. Patch ajouté pour cascade/recovery/UI copy. |
| ROUTES-NAV-COPY-0 | Partiellement fait | Des décisions route/nav/copy ont été appliquées, mais un nettoyage UI global reste nécessaire avant maquettes. |
| UI-A11Y-PERF-0 | Reporté | Ce n’est plus une étape bloquante avant maquettes. À faire en QA ou après maquettes si besoin. |
| ASSET-VALUATION-0 | À faire en priorité | Nouvelle priorité avant nettoyage UI et maquettes. |

### 25.3 Patch actuellement à surveiller : `PRE-MAQUETTES-FOLLOWUP-VALIDATION-0`

Dernier retour Claude/Codex :

- Cause racine du faux “Advisor en cours” :
  - `updateManualOperation` ne fermait pas les steps actifs quand l’opération passait terminale.
  - Ancien crash `.toFixed` → parent `failed`, child step `advisor_run` resté `running`.
- Correctifs annoncés :
  - cascade côté écriture dans `dashboard-advisor-repository.ts`;
  - nouveau sweep `recover-orphaned-manual-operation-steps.ts`;
  - réconciliation défensive à la lecture;
  - taxonomie dans `packages/ai/src/manual-operation-recovery.ts`;
  - UI : incident ancien récupéré au lieu d’échec rouge brut;
  - invalidation élargie après mutations Ops;
  - costs seed `pnpm db:seed:recurring-costs`;
  - endpoints memory storage/status/ensure;
  - catégorisation : règles utilisateur appliquées au backfill dry-run;
  - docs followup.

Statut exact au moment de ce brief :
- Changements **non committés** côté agent.
- Pas de tag.
- Pas de déploiement automatique.
- `pnpm check:ci:core` vert.
- Étape desktop échoue localement à cause de Rust/Cargo absent, à vérifier selon la CI réelle.

Avant toute nouvelle phase, vérifier si ce patch a été :
1. branché/committé ;
2. poussé ;
3. validé par CI ;
4. déployé ;
5. validé en prod.

### 25.4 Validation prod minimale du patch Followup

Après déploiement, vérifier :

```txt
- plus aucun child step actif sous parent terminal ;
- plus aucun `ai_run`, `ai_manual_operation`, `ai_manual_operation_step`, `ai_run_step` actif hors vrai run en cours ;
- UI Advisor/Ops n’affiche plus “en cours” à tort ;
- vieux incident `STALE_PARENT_OPERATION_FAILED` affiché comme “incident ancien récupéré”, pas comme erreur active rouge ;
- bouton Relancer contextualisé ou masqué ;
- recover stale run ne produit plus de faux échec UI ;
- `/ops/knowledge/enrichment/status` expose l’état Memory clair ;
- `POST /ops/knowledge/enrichment/ensure` crée/valide la collection Qdrant sans reset ;
- coûts : fixed vs actual vs estimated lisibles ;
- catégorisation : create/list/dry-run règles OK.
```

---

## 26. Nouvelle priorité avant maquettes — ASSET-VALUATION-0

### 26.1 Pourquoi cette phase devient prioritaire

Finance-OS ne peut pas être correctement maquetté si la donnée financière de base est fausse ou vide.

Problème actuel :
- Beaucoup d’actifs actions / ETF / crypto / cash / externes / manuels ont une valeur absente, nulle ou non fiable.
- Les pages Cockpit, Patrimoine, Investissements, Advisor et Coûts deviennent moins crédibles.
- La hiérarchie visuelle des maquettes serait faussée par des `0€`, `unknown`, `unavailable`, ou des montants incohérents.

Objectif ASSET-VALUATION-0 :
> Chaque actif doit avoir une valeur exploitable, ou à défaut un statut clair, humain, actionnable et non bloquant.

### 26.2 Actifs à couvrir

ASSET-VALUATION-0 doit couvrir ou diagnostiquer :

- cash EUR ;
- cash devises étrangères ;
- comptes bancaires Powens ;
- livrets / épargne ;
- positions IBKR ;
- positions Binance ;
- actions ;
- ETF ;
- fonds si présents ;
- obligations si présentes ;
- crypto ;
- actifs manuels ;
- immobilier / objets / patrimoine manuel si déjà modélisé ;
- actifs non cotés / custom ;
- positions avec ISIN mais sans ticker ;
- positions avec symbole ambigu ;
- actifs sans provider symbol clair.

### 26.3 Principe de valorisation cible

Chaîne cible :

```txt
asset / position
→ identité
→ mapping provider
→ prix
→ FX vers EUR
→ valeur EUR
→ fraîcheur
→ confiance
→ statut UI
```

Statuts de valorisation recommandés :

```txt
priced
estimated
manual
stale
unresolved
unavailable
```

Règles :
- si prix provider OK → afficher valeur ;
- si prix stale → afficher valeur + badge stale ;
- si actif manuel → valeur manuelle assumée ;
- si symbole ambigu → unresolved, pas de devinette agressive ;
- si provider down → unavailable, page non cassée ;
- si cash → valorisation directe + FX si nécessaire ;
- demo → valeurs déterministes réalistes.

### 26.4 Modèles recommandés

À adapter au schéma existant si des tables équivalentes existent.

#### AssetIdentity / AssetProviderMapping

But : résoudre chaque actif vers un ou plusieurs providers.

Champs possibles :
- `asset_id`
- `provider`
- `provider_symbol`
- `exchange`
- `isin`
- `figi`
- `conid`
- `base_symbol`
- `quote_symbol`
- `currency`
- `asset_class`
- `priority`
- `confidence`
- `status`
- `last_resolved_at`

#### AssetPriceSnapshot

But : stocker les prix récupérés.

Champs possibles :
- `asset_id`
- `provider`
- `provider_symbol`
- `price`
- `currency`
- `as_of`
- `market_state`
- `source_type`
- `confidence`
- `stale_after`

#### AssetValuationSnapshot

But : stocker/calculer la valeur d’un actif ou d’une position.

Champs possibles :
- `asset_id`
- `position_id`
- `account_id`
- `quantity`
- `unit_price`
- `price_currency`
- `fx_rate_to_base`
- `base_currency=EUR`
- `value_original_currency`
- `value_base_currency`
- `cost_basis_base_currency`
- `unrealized_pnl_base_currency`
- `unrealized_pnl_percent`
- `valuation_status`
- `valuation_source`
- `provider`
- `as_of`
- `stale_after`
- `confidence`
- `error_code`
- `safe_error_message`

### 26.5 Providers et stratégie

Provider strategy recommandée :

#### Actions / ETF / fonds cotés
1. Broker value si IBKR/Powens fournit déjà un `marketValue` fiable.
2. EODHD si mapping disponible.
3. Twelve Data fallback.
4. Manual price fallback.
5. Unavailable clair.

#### Crypto
1. Binance si position vient de Binance et paire connue.
2. CoinGecko si mapping coin id disponible.
3. Twelve Data / EODHD crypto fallback si déjà configuré.
4. Manual fallback.
5. Unavailable clair.

#### Cash
- balance = valeur ;
- devise → EUR via FX ;
- status = `priced` ou `derived`.

#### Actifs manuels / non cotés
- valeur user-provided ;
- date ;
- devise ;
- source note ;
- confidence manual ;
- no provider fetch automatique.

### 26.6 Job cible

Créer ou compléter un job :

```txt
asset-valuation-refresh
```

Fonctions :
- lister toutes les positions/actifs ;
- résoudre mappings ;
- batcher provider requests ;
- appliquer FX ;
- écrire snapshots ;
- produire coverage report :
  - total assets ;
  - priced ;
  - manual ;
  - stale ;
  - unresolved ;
  - unavailable ;
  - provider failures ;
  - total value EUR ;
  - coverage percentage.

Doit être :
- admin manual run ;
- dry-run disponible ;
- idempotent ;
- fail-soft ;
- compatible refresh/orchestration ;
- rate-limit aware ;
- sans coût excessif.

### 26.7 API / UI minimale

Ne pas faire de refonte UI dans ASSET-VALUATION-0.

Ajouter seulement :
- badges valorisation ;
- table actifs non valorisés ;
- bouton admin refresh valuation ;
- status coverage ;
- erreurs provider uniquement admin/ops ;
- enrichissement DTO Cockpit/Patrimoine/Investissements/Advisor si nécessaire.

Endpoints candidats :
- `/dashboard/assets/valuation/status`
- `/dashboard/investments/valuation/status`
- enrichir `/dashboard/summary`
- enrichir `/dashboard/patrimoine`
- enrichir `/dashboard/investments`

### 26.8 Tests attendus

Tester :
- cash EUR direct ;
- cash USD → EUR ;
- action provider price ;
- ETF via ISIN/mapping ;
- crypto Binance/CoinGecko ;
- actif manuel ;
- provider down ;
- stale price ;
- ambiguous symbol ;
- batch refresh idempotent ;
- dry-run sans mutation ;
- demo values déterministes.

### 26.9 Sortie attendue du chat dédié Asset Valuation

Le chat dédié `ASSET-VALUATION-0` doit produire :
1. audit repo ;
2. diagnostic DB/data ;
3. plan provider/mapping ;
4. migrations additives si nécessaires ;
5. job refresh ;
6. endpoints/DTO ;
7. UI minimale ;
8. tests ;
9. runbook post-deploy ;
10. rapport `docs/debug/ASSET_VALUATION_0.md`.

---

## 27. Phase suivante après Asset Valuation — UI-CLEANUP-CONTENT-MAP-0

### 27.1 Objectif

Après la valorisation des actifs, faire une passe de nettoyage UI **avant les maquettes**.

But :
- retirer le bruit ;
- retirer les pages/blocs qui ne doivent plus exister ;
- figer ce que chaque page doit contenir ;
- produire un rapport directement exploitable par Claude Design/Stitch.

### 27.2 Nettoyage attendu

Nettoyer / confirmer :
- ReactBits partout sauf login background ;
- Aurora Pink hors source de vérité ;
- blocs “Prochaines actions” ;
- CTA “Demander à l’Advisor” partout ;
- wording IA/corporate ;
- JSON brut ;
- jargon GraphRAG/context-bundle/confidence model ;
- pages techniques visibles ;
- routes admin hors admin ;
- coûts/sync/logs hors pages utilisateur ;
- Social Intelligence sans coûts/sync ;
- Intégrations sans logs/coûts/runs ;
- Santé sans PixelBlast/Env Diagnostics ;
- Objectifs sans Antigravity/hero ;
- Cockpit sans Liquid Ether/hero ;
- Fiscalité supprimée ;
- Sources supprimée ;
- Free Firehose absorbée dans Orchestration ;
- Paramètres absorbée/supprimée selon audit.

### 27.3 Rapport page par page attendu

Créer :

```txt
docs/design/UI_CLEANUP_CONTENT_MAP.md
```

Pour chaque page :
- intention principale ;
- utilisateur cible ;
- contenu gardé ;
- contenu supprimé ;
- features visibles ;
- features déplacées ailleurs ;
- états loading/empty/error/degraded ;
- données nécessaires ;
- dépendances API ;
- rôle demo/admin ;
- risques ;
- priorité maquette.

Pages à documenter :
- Cockpit ;
- Dépenses ;
- Patrimoine ;
- Investissements ;
- Objectifs ;
- Advisor ;
- Chat ;
- Mémoire 3D ;
- Radar ;
- Social Intelligence ;
- Orchestration ;
- Coûts ;
- Santé ;
- Intégrations ;
- Login ;
- Trading Lab en harmonisation uniquement.

### 27.4 Sortie de cette phase

Après `UI-CLEANUP-CONTENT-MAP-0`, le produit doit avoir :
- une IA claire ;
- une nav claire ;
- des pages nettoyées ;
- un contenu par page figé ;
- un handoff design stable.

---

## 28. Phase maquettes — MAQUETTES-HANDOFF-0

### 28.1 Quand lancer les maquettes

Lancer les maquettes uniquement après :
- patch Followup validé ou au moins non bloquant ;
- ASSET-VALUATION-0 terminé ou clairement cadré ;
- UI cleanup/content map terminé ;
- brief Command Pixel stabilisé.

### 28.2 Objectif

Créer les prompts Claude Design / Stitch pour générer des maquettes qui respectent :
- Finance-OS Command Pixel ;
- contenu réel des pages ;
- données valorisées ;
- séparation utilisateur/admin ;
- no ReactBits hors login ;
- no Aurora Pink ;
- no wording IA ;
- no JSON brut.

### 28.3 Ordre des maquettes recommandé

1. Shell / top navbar / dropdowns / mobile nav.
2. Cockpit.
3. Patrimoine.
4. Investissements.
5. Dépenses.
6. Advisor.
7. Chat.
8. Mémoire 3D.
9. Radar.
10. Social Intelligence.
11. Orchestration.
12. Coûts.
13. Santé.
14. Intégrations.
15. Login.

Trading Lab :
- pas de maquette profonde ;
- uniquement harmonisation visuelle globale si nécessaire.

### 28.4 Critères de sélection

Chaque maquette sera évaluée sur :
- clarté ;
- crédibilité financière ;
- beauté premium ;
- DA Command Pixel ;
- lisibilité data ;
- faisabilité implementation ;
- admin/demo separation ;
- responsive ;
- accessibilité probable ;
- performance probable.

---

## 29. Phase implémentation UI — UI-REFONTE-IMPLEMENTATION-0

### 29.1 Principe

Ne pas lancer un énorme prompt unique qui refait toute l’app sans garde-fous.

Découpage recommandé :
1. Foundations tokens/fonts/remove Aurora Pink.
2. Remove ReactBits except login background.
3. Shell/top navbar/mobile nav/command palette.
4. Core components surfaces/data primitives.
5. Page argent : Cockpit, Patrimoine, Investissements, Dépenses, Objectifs.
6. IA : Advisor, Chat, Mémoire Graph.
7. Radar/Social.
8. Ops : Orchestration, Coûts, Santé, Intégrations.
9. Login.
10. QA/polish/docs.

### 29.2 Garde-fous

- no JSON brut ;
- no page technique hors admin ;
- no ReactBits hors login ;
- no Aurora Pink hardcoded ;
- no hidden run/cost provider logic broken ;
- no Trading Lab deep refactor ;
- no destructive migrations ;
- no provider pipeline deletion ;
- demo/admin preserved.

---

## 30. Handoff ultra-court pour nouveau chat Asset Valuation

À coller dans un nouveau chat Finance-OS :

```txt
Je reprends le chantier Finance-OS UI/UX. Avant les maquettes, on ouvre un chat dédié ASSET-VALUATION-0.

Contexte :
Finance-OS est un OS financier personnel premium, single-user, demo/admin dual-path, avec direction UI future “Finance-OS Command Pixel”. La refonte UI est en préparation, mais elle est bloquée par un problème produit : quasiment aucun actif action/ETF/crypto/cash/externe/manuel n’a une valeur fiable. Les pages Cockpit, Patrimoine, Investissements et Advisor sont donc faussées.

Objectif du chat :
Auditer et implémenter une couche robuste de valorisation d’actifs.

À couvrir :
- actions ;
- ETF ;
- crypto ;
- cash ;
- IBKR Flex ;
- Binance ;
- Powens/wealth ;
- actifs manuels ;
- non cotés/custom ;
- positions avec ISIN/FIGI/CONID/symbol ambigu ;
- FX vers EUR ;
- stale/unresolved/unavailable/manual statuses.

Livrables :
- audit repo + DB ;
- mapping provider ;
- modèle valuation ;
- job `asset-valuation-refresh` dry-run/real-run ;
- endpoints/DTO coverage ;
- UI minimale de statut, pas refonte ;
- tests ;
- runbook post-deploy ;
- rapport `docs/debug/ASSET_VALUATION_0.md`.

Contraintes :
- ne pas faire de maquettes ;
- ne pas refondre UI ;
- ne pas supprimer historique ;
- ne pas reset DB ;
- ne pas introduire provider payant obligatoire sans flag ;
- fail-soft ;
- demo/admin préservé ;
- no auto-trading.
```

---

## 31. Handoff ultra-court pour nouveau chat UI Cleanup

À coller après Asset Valuation :

```txt
Je reprends le chantier Finance-OS UI/UX après ASSET-VALUATION-0.

Objectif :
Lancer UI-CLEANUP-CONTENT-MAP-0 avant les maquettes.

But :
Nettoyer l’UI pour garder uniquement ce qu’on veut, retirer le bruit technique/IA, puis produire un rapport page par page pour faciliter Claude Design/Stitch.

À faire :
- supprimer/retirer ReactBits hors login ;
- supprimer Aurora Pink comme identité ;
- supprimer “Prochaines actions” ;
- retirer CTA “Demander à l’Advisor” partout ;
- retirer wording IA/corporate ;
- retirer JSON brut/jargon GraphRAG/context-bundle ;
- déplacer coûts/sync/runs/logs vers Ops ;
- cacher admin/Ops hors admin ;
- supprimer Fiscalité/Sources/Env Diagnostics ;
- absorber Free Firehose dans Orchestration ;
- challenger Paramètres ;
- transformer Signaux/Marchés en Radar minimaliste ;
- Social Intelligence = galerie comptes suivis ;
- Intégrations = connexions simples ;
- Santé = état global clair.

Livrable principal :
`docs/design/UI_CLEANUP_CONTENT_MAP.md`

Pour chaque page :
- intention ;
- contenu gardé ;
- contenu supprimé ;
- features visibles ;
- features déplacées ;
- états empty/loading/error/degraded ;
- données nécessaires ;
- demo/admin ;
- priorité maquette.

Ne pas faire de maquettes dans ce chat.
```

