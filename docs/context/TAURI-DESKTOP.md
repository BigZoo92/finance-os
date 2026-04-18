# Tauri 2 Desktop Integration

> Derniere mise a jour: 2026-04-18

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
- Windows desktop build deps: Microsoft C++ Build Tools ("Desktop development with C++"), WebView2, puis redemarrage du terminal apres installation de Rust

## Assets desktop

- `apps/desktop/src-tauri/icons/icon.png` doit etre un PNG carre en RGBA 32-bit
- `apps/desktop/src-tauri/icons/icon.ico` est derive automatiquement de `icon.png` au moment du build pour satisfaire `tauri-build` sous Windows; ne pas le maintenir a la main
- les PNG indexes / palette (`color type 3`) font echouer `tauri::generate_context!()` avant la compilation effective
- reference Tauri: https://tauri.app/develop/icons/

## Commandes locales

Depuis la racine du repo:

- `pnpm desktop:doctor` - verifie le format de `src-tauri/icons/icon.png`, la presence de `cargo` / `cargo tauri`, et les deps Linux Tauri quand l'hote est Linux
- `pnpm desktop:dev` - demarre Tauri Desktop + web dev server (via `beforeDevCommand`) apres preflight `desktop:doctor`
- `pnpm desktop:build` - build production desktop (web build + bundle Tauri) apres preflight `desktop:doctor`
- `pnpm desktop:typecheck` - verifie le crate desktop apres preflight `desktop:doctor`

## iOS-ready path (scaffold uniquement)

Tauri 2 expose un chemin mobile. Dans ce step, on documente le workflow sans promettre un export magique:

- `pnpm desktop:ios:targets` - ajoute les targets Rust iOS (`aarch64-apple-ios`, `aarch64-apple-ios-sim`, `x86_64-apple-ios`)
- `pnpm desktop:ios:init` - initialise le projet iOS (macOS + Xcode requis) et passe d'abord par `desktop:ios:targets` pour eviter les erreurs de cible manquante
- `pnpm desktop:ios:dev` - lance un run dev iOS
- `pnpm desktop:ios:build` - build iOS

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
- `pnpm desktop:build` (inclut le preflight `desktop:doctor` pour remonter plus tot un probleme d'asset ou d'outillage)
- pour la parite locale ou Codex, `pnpm check:ci` inclut aussi `pnpm desktop:build` une fois l'environnement desktop prepare

Le job web existant reste intact.
