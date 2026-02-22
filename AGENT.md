# AGENT.md - Source de verite pour les agents IA

Derniere verification repo: 2026-02-21.

## 0) Regle non negociable: maintenir ce fichier a jour

Tout agent qui modifie le repo doit aussi evaluer si `AGENT.md` doit etre mis a jour.

Mise a jour obligatoire de `AGENT.md` dans le meme patch/PR si changement de:
- structure monorepo (`apps/*`, `packages/*`, `infra/*`)
- scripts (`package.json` root ou workspace)
- conventions architecture/code
- gestion des variables d'environnement
- workflow dev/validation
- conventions UI/styles/shared package

Si aucun update `AGENT.md` n'est necessaire, l'agent doit le dire explicitement dans son resume final.

---

## 1) Vue d'ensemble du repo (onboarding rapide)

### Mission actuelle (inference basee sur le code)

`finance-os` est un monorepo TypeScript pour une plateforme finance perso.
Etat actuel:
- front web TanStack Start avec dashboard majoritairement mock
- API Elysia avec endpoints de sante (`/health`, `/db/health`)
- worker Bun avec heartbeat DB + Redis
- couche DB Drizzle (Postgres) avec migration initiale `technical_probe`
- Redis partage via package dedie
- UI shared package (`@finance-os/ui`) avec composants shadcn mutualises

Le repo est deja operationnel pour bootstrap technique, mais plusieurs parties metier sont WIP.

### Structure reelle du monorepo

```
apps/
  api/       # Elysia API (Bun runtime)
  web/       # TanStack Start + Router + React 19 + Tailwind v4
  worker/    # Worker Bun (heartbeat et jobs)
packages/
  config-ts/ # tsconfig partages (base, web, server)
  db/        # Drizzle schema, client postgres, migrations
  env/       # validation env centralisee (dotenv + zod)
  redis/     # client Redis partage
  ui/        # design system shared (shadcn + styles globals)
  domain/    # dossier present mais vide (reserve/WIP)
infra/
  docker/
    docker-compose.dev.yml # Postgres + Redis pour dev local
```

### Carte des responsabilites par workspace

- `apps/web`: UI metier, routing, integrations TanStack Query, consommation API HTTP.
- `apps/api`: endpoints HTTP, access DB via `@finance-os/db`, env via `@finance-os/env`.
- `apps/worker`: execution jobs/heartbeat, access DB + Redis, env via `@finance-os/env`.
- `packages/db`: creation client DB, schema Drizzle, migrations.
- `packages/env`: schema et parsing env centralises (charge `../../.env` depuis package).
- `packages/redis`: factory de client Redis.
- `packages/ui`: composants et tokens CSS partages.
- `packages/config-ts`: presets TypeScript strict.

### Dependances inter-workspaces (etat constate)

- `@finance-os/web` -> `@finance-os/ui`
- `@finance-os/api` -> `@finance-os/db`, `@finance-os/env`
- `@finance-os/worker` -> `@finance-os/db`, `@finance-os/redis`, `@finance-os/env`
- `@finance-os/db` -> Postgres/Drizzle (pas de dependance `@finance-os/env`)
- `@finance-os/env` -> `dotenv` + `zod`

Flux runtime:
- `web` <HTTP> `api`
- `api` <SQL> `postgres`
- `worker` <SQL> `postgres`
- `worker` <TCP> `redis`

### Deja en place vs WIP visible

Deja en place:
- infra docker locale (Postgres + Redis)
- validation env centralisee pour API/worker
- type strict TS de base
- Biome lint/format
- UI shared package et styles centralises

WIP visible:
- donnees dashboard majoritairement mock
- package `packages/domain` vide
- seulement une migration de bootstrap DB
- incoherences scripts web au root (voir section pieges)

---

## 2) Regles de travail pour agents IA (obligatoires)

1. Toujours analyser avant de modifier.
2. Faire des patches petits, cibles, testables.
3. Interdire les refactors opportunistes hors scope.
4. Respecter strictement les conventions deja presentes.
5. Reutiliser les packages partages existants avant toute duplication locale.
6. Verifier les impacts cross-package avant merge.
7. Si la tache est non triviale, proposer un plan court avant edit.
8. Preserver DX + perfs + typage strict.
9. Ne jamais modifier manuellement les fichiers generes:
- `apps/web/src/routeTree.gen.ts`
10. Apres modification, executer au minimum les validations ciblees du scope.
11. Mettre a jour `AGENT.md` si les regles/schemas/scripts/structure changent.

---

## 3) Workflow agentique recommande

### Single-agent (par defaut)

1. Cadrage: scope, fichiers cibles, impacts.
2. Lecture: scripts + fichiers lies au scope.
3. Plan court: 3-6 etapes max si tache complexe.
4. Implementation incrementale: petits commits logiques.
5. Validation ciblee: typecheck/lint/build/tests pertinents.
6. Finalisation: update docs necessaires (dont `AGENT.md` si requis).

### Multi-agent (recommande pour taches importantes)

Ordre recommande:
1. Agent Architecte
2. Agent Implementation
3. Agent Reviewer
4. Agent QA/Validation
5. Agent Doc/Changelog

Artefacts attendus par role:

- Architecte:
  - impact map (workspaces/fichiers touches)
  - proposition technique et non-goals
  - plan de patch incremental
- Implementation:
  - patchs limites au plan valide
  - note explicite des ecarts au plan
- Reviewer:
  - findings par severite (bug, regression, edge case, perf, types)
  - risques residuels
- QA/Validation:
  - commandes executees + resultats
  - check de non-regression scope
- Doc/Changelog:
  - update docs techniques et operationnelles
  - verification que `AGENT.md` reste coherent

Passation entre agents (format court recommande):
- Scope confirme:
- Fichiers modifies:
- Validations executees:
- Risques ouverts:
- Prochaine action:

Regles anti-conflit multi-agent:
- un seul agent proprietaire d'un meme fichier a la fois
- decouper par boundaries (`apps/web`, `apps/api`, `packages/ui`, etc.)
- fusionner apres revue explicite des zones partagees (env, db, scripts)

---

## 4) Runbook commandes (source de verite)

Commandes observees dans les `package.json` au 2026-02-21.

### Installation / prerequisites

- Installer deps monorepo: `pnpm install`
- Runtime necessaires selon scope:
- `pnpm` (workspace manager)
- `bun` (API/worker dev/start)
- `docker` + `docker compose` (Postgres/Redis local)

### Root scripts (`package.json`)

- Dev:
- `pnpm dev:apps` (api + worker + web en parallele)
- `pnpm dev:all` (infra up puis apps)
- `pnpm api:dev`
- `pnpm worker:dev`
- `pnpm web:dev`

- Infra:
- `pnpm infra:up`
- `pnpm infra:down`
- `pnpm infra:logs`
- `pnpm infra:ps`

- DB:
- `pnpm db:generate`
- `pnpm db:migrate`
- `pnpm db:studio`

- Qualite:
- `pnpm build`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm lint:fix`
- `pnpm format`
- `pnpm format:check`
- `pnpm check`
- `pnpm check:write`

- Cibles workspace:
- `pnpm api:start`
- `pnpm api:typecheck`
- `pnpm worker:start`
- `pnpm worker:typecheck`
- `pnpm web:build`
- `pnpm web:test`
- `pnpm web:start` (voir gap ci-dessous)
- `pnpm web:typecheck` (voir gap ci-dessous)

### Scripts workspace

- `apps/api`:
- `pnpm --filter @finance-os/api dev`
- `pnpm --filter @finance-os/api start`
- `pnpm --filter @finance-os/api typecheck`

- `apps/worker`:
- `pnpm --filter @finance-os/worker dev`
- `pnpm --filter @finance-os/worker start`
- `pnpm --filter @finance-os/worker typecheck`

- `apps/web`:
- `pnpm --filter @finance-os/web dev`
- `pnpm --filter @finance-os/web build`
- `pnpm --filter @finance-os/web preview`
- `pnpm --filter @finance-os/web test`

- `packages/db`:
- `pnpm --filter @finance-os/db db:generate`
- `pnpm --filter @finance-os/db db:migrate`
- `pnpm --filter @finance-os/db db:studio`
- `pnpm --filter @finance-os/db typecheck`

- `packages/env`, `packages/redis`, `packages/ui`:
- `pnpm --filter <pkg> typecheck`

### Gaps scripts constates (a connaitre avant execution)

- `pnpm web:start` au root appelle `@finance-os/web start`, mais `apps/web/package.json` n'a pas de script `start` (seulement `preview`).
- `pnpm web:typecheck` au root appelle `@finance-os/web typecheck`, mais `apps/web/package.json` n'a pas de script `typecheck`.
- Impact: `pnpm typecheck` root (`-r --if-present`) ne typecheck pas `apps/web` actuellement.

---

## 5) Conventions code et architecture (specifiques repo)

### TypeScript / qualite

- Base TS stricte via `packages/config-ts/base.json`.
- `strict: true` et options strictes activees.
- Biome est la reference lint/format (pas ESLint/Prettier).
- Indentation 2 espaces, LF, quotes simples ciblees par Biome.

### Separation apps vs packages

- `apps/*` = orchestration runtime + logique metier par executable.
- `packages/*` = briques partagees reutilisables.
- Eviter de faire dependre un package de code applicatif (`apps/*`).

### Conventions env

- API/worker lisent env via `@finance-os/env` (`getApiEnv`, `getWorkerEnv`).
- `@finance-os/env` charge `../../.env` et valide avec Zod.
- Eviter `process.env` direct dans `apps/api` et `apps/worker` hors package env.
- Toute nouvelle variable server doit etre ajoutee a:
- `.env.example`
- schema `packages/env/src/index.ts`
- code consommateur

### Conventions DB

- DB access via `createDbClient(databaseUrl)` depuis `@finance-os/db`.
- Schema dans `packages/db/src/schema/*`, exporte via `schema/index.ts`.
- Migrations dans `packages/db/drizzle/*` generees via Drizzle Kit.
- `drizzle.config.cjs` lit `../../.env` et exige `DATABASE_URL`.

### Conventions UI / styles

- Importer composants UI partages via `@finance-os/ui/components`.
- Ne pas dupliquer des composants shadcn dans `apps/web` si generic/reutilisable.
- Styles source de verite dans `packages/ui/src/styles/globals.css`.
- `apps/web/src/styles.css` importe `@finance-os/ui/styles.css`.
- Garder les directives Tailwind `@source` coherentes:
- package UI scanne `../**/*.{ts,tsx}`
- web scanne `./**/*.{ts,tsx}`

### Conventions routing web

- Router file-based TanStack.
- `apps/web/src/routeTree.gen.ts` est genere: ne jamais editer a la main.
- Ajouter/modifier des routes via fichiers dans `apps/web/src/routes/*`.

### Conventions imports

- `apps/web` utilise alias `@/*` vers `apps/web/src/*`.
- Workspaces via noms `@finance-os/*` (pas de chemins relatifs inter-workspace).

---

## 6) How to modify safely (playbooks par type de tache)

### A. Ajouter un endpoint API

Fichiers a inspecter d'abord:
- `apps/api/src/index.ts`
- `apps/api/src/env.ts`
- `packages/env/src/index.ts`
- `packages/db/src/*` (si DB)

Fichiers a modifier:
- route dans `apps/api/src/index.ts`
- schema env si nouvelle variable
- eventuels appels DB via `@finance-os/db`

Validations minimales:
- `pnpm api:typecheck`
- `pnpm api:dev` puis test manuel endpoint

Erreurs frequentes:
- oublier la validation env
- hardcoder un host/port au lieu de passer par env
- ignorer fermeture propre des ressources en cas de nouveau client

### B. Ajouter un package partage

Fichiers a inspecter d'abord:
- `pnpm-workspace.yaml`
- `packages/config-ts/*`
- package similaire existant (`packages/env`, `packages/redis`, etc.)

Fichiers a modifier:
- nouveau dossier `packages/<nom>`
- `package.json`, `tsconfig.json`, `src/*`
- consumer package `package.json` + imports

Validations minimales:
- `pnpm -r --if-present typecheck`
- typecheck/build du/des consumers

Erreurs frequentes:
- dupliquer une logique deja disponible dans un package existant
- introduire dependance de package vers `apps/*`
- acces direct `process.env` dans package generique

### C. Ajouter une migration Drizzle

Fichiers a inspecter d'abord:
- `packages/db/src/schema/index.ts`
- `packages/db/src/schema/*`
- `packages/db/drizzle.config.cjs`

Fichiers a modifier:
- nouveaux champs/tables schema
- export schema index
- migration generee dans `packages/db/drizzle`

Validations minimales:
- `pnpm db:generate`
- `pnpm db:migrate`
- `pnpm --filter @finance-os/db typecheck`

Erreurs frequentes:
- oublier d'exporter le nouveau schema
- lancer generate/migrate sans `.env` correct
- modifier manuellement les meta Drizzle sans necessite

### D. Ajouter un composant UI partage (shadcn)

Fichiers a inspecter d'abord:
- `packages/ui/components.json`
- `packages/ui/src/components/index.ts`
- composants existants sous `packages/ui/src/components/ui/*`

Fichiers a modifier:
- nouveau composant dans `packages/ui/src/components/ui/`
- export dans `packages/ui/src/components/index.ts`
- styles globaux uniquement si necessaire

Validations minimales:
- `pnpm --filter @finance-os/ui typecheck`
- `pnpm web:dev` (ou build web) pour verifier integration

Erreurs frequentes:
- creer composant equivalent local dans `apps/web`
- ne pas exporter le composant depuis `index.ts`
- casser les imports `@finance-os/ui/lib/utils`

### E. Ajouter un composant metier web

Fichiers a inspecter d'abord:
- `apps/web/src/routes/*`
- `apps/web/src/components/*`
- `apps/web/src/styles.css`

Fichiers a modifier:
- nouveau composant dans `apps/web/src/components/...`
- route/page qui le consomme

Validations minimales:
- `pnpm web:dev`
- `pnpm web:build`
- `pnpm web:test`

Erreurs frequentes:
- utiliser des composants UI locaux au lieu de `@finance-os/ui/components`
- editer `routeTree.gen.ts` a la main
- ajouter des classes Tailwind non detectees car `@source` mal place

### F. Ajouter une variable d'environnement

Fichiers a inspecter d'abord:
- `.env.example`
- `packages/env/src/index.ts`
- `apps/web/src/env.ts` (si variable client Vite)
- `infra/docker/docker-compose.dev.yml` (si service impacte)

Fichiers a modifier:
- `.env.example`
- schema env adapte
- code consommateur

Validations minimales:
- typecheck app/package concerne
- run app concernee (`api`, `worker`, `web`)

Erreurs frequentes:
- ajouter variable sans schema Zod
- oublier prefix `VITE_` cote client web
- mismatch entre `.env` local et `.env.example`

### G. Ajouter un job worker

Fichiers a inspecter d'abord:
- `apps/worker/src/index.ts`
- `apps/worker/src/env.ts`
- `packages/db/src/*`
- `packages/redis/src/index.ts`

Fichiers a modifier:
- logique job dans `apps/worker/src/index.ts` (ou module dedie)
- env/schema si nouvelle config timing/feature

Validations minimales:
- `pnpm worker:typecheck`
- `pnpm worker:dev` + verification logs

Erreurs frequentes:
- oublier cleanup dans `shutdown`
- ne pas proteger les erreurs async dans intervalles
- ouvrir plusieurs connexions DB/Redis inutilement

### H. Corriger un bug style/Tailwind/shadcn monorepo

Fichiers a inspecter d'abord:
- `apps/web/src/styles.css`
- `packages/ui/src/styles/globals.css`
- composant web ou UI concerne

Fichiers a modifier:
- styles dans le bon niveau (app vs package shared)
- classes du composant impacte

Validations minimales:
- `pnpm web:dev`
- `pnpm web:build`

Erreurs frequentes:
- corriger localement dans web un token qui doit vivre dans `packages/ui`
- casser les directives `@source`
- creer divergence visuelle entre composants shared et metier

---

## 7) Checklist de validation avant fin de tache

- scope respecte, pas de refactor hors demande
- imports workspace corrects (`@finance-os/*`, `@/*`)
- typecheck/lint/build/tests cibles executes
- pas de duplication de logique deja sharee
- env/doc/scripts mis a jour si necessaire
- migrations generees/appliquees si schema DB touche
- UI/styles coherents (shared vs app)
- `AGENT.md` verifie/maj si conventions ou workflows impactes

---

## 8) Pieges / anti-patterns observes dans ce repo

- `apps/web/src/routeTree.gen.ts` est genere et peut etre ecrase.
- Scripts root `web:start` et `web:typecheck` non alignes avec scripts reels de `apps/web`.
- `pnpm typecheck` root ne couvre pas `apps/web` (car script absent cote web).
- `packages/domain` est vide: ne pas le referencer comme package actif tant qu'il n'existe pas.
- Web appelle actuellement l'API via URL hardcodee `http://127.0.0.1:3001/health` dans `api-status-card.tsx`.
- Risque monorepo Tailwind: oublier de maintenir `@source` cote app et package UI.
- Risque env: contourner `@finance-os/env` cree des divergences entre runtime et schema.

---

## 9) Templates de prompts pour futurs agents

### Template: feature metier sans refactor hors scope

```
Objectif: ajouter <feature> dans <workspace cible>.
Contraintes:
- patch minimal, pas de refactor opportuniste
- reutiliser les packages shared existants
- respecter AGENT.md
- lister fichiers modifies + validations executees
Sortie attendue: implementation + resume risques residuels.
```

### Template: bugfix minimal

```
Corrige le bug <description> dans <fichier/zone>.
Contraintes:
- diff minimal
- pas de changement architecture
- ajouter uniquement les validations necessaires au bugfix
Fournir: cause racine, patch, preuve de validation.
```

### Template: endpoint + contrat + integration web

```
Ajoute endpoint API <route> puis connecte-le au front <page/composant>.
Contraintes:
- env/schema mis a jour si necessaire
- types stricts, pas de any
- pas de duplication des composants UI shared
Fournir: impact map apps/packages + commandes de validation executees.
```

### Template: refacto package partage sans casser apps

```
Refactore `packages/<name>` pour <objectif>.
Contraintes:
- API publique du package stable ou migration explicite
- verifier tous les consumers
- patch incremental
Fournir: avant/apres, compatibilite, risques, validations.
```

### Template: review perf/types uniquement

```
Fais une review limitee a:
- bugs potentiels
- regressions perf
- problemes de typage strict
Ignore style subjectif.
Sortie: findings classes par severite avec fichiers et actions recommandees.
```

---

## 10) Agent startup checklist (ultra courte)

1. Lire `AGENT.md`.
2. Scanner structure (`apps/*`, `packages/*`, `infra/*`).
3. Lire scripts root + workspace cible.
4. Identifier boundaries et impacts cross-package.
5. Ecrire un plan de patch court.
6. Implementer en petites etapes.
7. Executer validations ciblees.
8. Resumer changements + risques + besoin de MAJ `AGENT.md`.

---

## Bonus: decisions connues / guide package vs app

### Decisions techniques visibles (ADR light)

- Monorepo pnpm sans orchestrateur type turbo/nx.
- API/worker sur Bun, web sur Vite/TanStack Start.
- Environnement server valide centralement via `@finance-os/env`.
- UI shadcn mutualisee via `@finance-os/ui`.
- Lint/format standardises via Biome.

### Quand creer un nouveau package vs rester dans une app

Creer un package si:
- logique reutilisable par 2+ apps
- contrat stable et independant du runtime app
- besoin de partage de types/utilitaires/clients

Rester dans une app si:
- logique purement metier locale
- usage unique dans une seule app
- couplage fort a un ecran/route/workflow specifique

### Tech debt courte (constatee)

- aligner scripts root web (`start`, `typecheck`) avec `apps/web/package.json`
- definir role concret de `packages/domain` ou supprimer dossier vide
- introduire checks automatiques couvrant `apps/web` typecheck explicite

