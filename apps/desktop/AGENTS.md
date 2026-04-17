# AGENTS.md - apps/desktop

Scope: `apps/desktop/**`

## Local Rules

- Keep the desktop target as a thin Tauri 2 shell around the existing web app; do not fork UI/business logic here.
- Keep demo/admin behavior unchanged: demo remains default deterministic mode, admin stays behind existing auth/session gates from web+api.
- Keep native permissions least-privilege. Do not add shell/fs/http plugins unless the feature explicitly requires them and includes a security review.
- Keep runtime logging structured and low-noise; startup/failure logs should be machine-readable.
- Keep iOS work scoped to scaffold/documentation only unless a task explicitly requests native mobile implementation.

## Verify

- `pnpm desktop:dev`
- `pnpm desktop:build`

## Pitfalls

- Do not add secrets to client-side env (`VITE_*`).
- Do not introduce desktop-only privileged backdoors.
- Do not bypass `apps/web` as the core product source of truth.
