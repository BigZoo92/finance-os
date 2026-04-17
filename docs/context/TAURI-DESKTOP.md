# Tauri 2 Desktop Integration

> Derniere mise a jour: 2026-04-17

## Objectif

Finance-OS desktop reste un **shell Tauri 2** autour de l'application web existante (`apps/web`).
Aucune logique produit ne doit diverger entre browser et desktop sans contrainte plateforme explicite.

## Architecture

- Frontend reutilise: `apps/web`
- Shell natif: `apps/desktop/src-tauri`
- API/backend model: inchange (`apps/web` continue a utiliser `/api/*` et les memes gardes demo/admin)

## Preconditions outillage

- Rust toolchain stable (`rustup`, `cargo`)
- Tauri CLI (`cargo install tauri-cli --locked --version ^2`)
- Linux desktop build deps: `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`, `patchelf`

## Commandes locales

Depuis la racine du repo:

- `pnpm desktop:dev` — demarre Tauri Desktop + web dev server (via `beforeDevCommand`)
- `pnpm desktop:build` — build production desktop (web build + bundle Tauri)
- `pnpm desktop:typecheck` — information/versioning Tauri CLI

## iOS-ready path (scaffold uniquement)

Tauri 2 expose un chemin mobile. Dans ce step, on documente le workflow sans promettre un export magique:

- `pnpm desktop:ios:init` — initialise le projet iOS (macOS + Xcode requis)
- `pnpm desktop:ios:dev` — lance un run dev iOS
- `pnpm desktop:ios:build` — build iOS

Limitations actuelles:

- Non valide sous Linux CI (outil Apple absent)
- Pas de logique mobile native specifique dans cette PR
- Le produit reste pilote par l'experience web existante

## Securite runtime

- `withGlobalTauri=false` pour eviter une surface globale JS inutile
- capability par defaut minimale (`core:default` seulement)
- aucun plugin shell/fs/http ajoute
- aucun secret ajoute en `VITE_*`

## Observabilite

Le runtime Rust emit des logs JSON structures sur:

- startup du shell desktop
- readiness de fenetre principale
- echec fatal de boot

Ces logs sont volontairement limites pour eviter le bruit.

## CI

Le workflow CI ajoute un job `tauri-validate` dedie:

- installation deps Linux Tauri
- `pnpm install --frozen-lockfile`
- `pnpm desktop:build`

Le job web existant reste intact.
