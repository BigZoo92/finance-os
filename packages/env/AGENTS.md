# Environment instructions

Scope: `packages/env/**`.

- `src/index.ts` is the parsing/validation source of truth; `src/diagnostics.ts` owns cross-runtime checks.
- Secrets are server-only. `VITE_*` is limited to intentionally public browser configuration.
- IBKR/Binance credentials remain optional at startup, complete-set validated, and mapped only to consuming server runtimes.
- Production-only requirements belong in schemas/diagnostics, not deployment folklore.
- Env changes update `.env.example` or `.env.prod.example`, Compose/workflow wiring, tests, and `docs/configuration.md` when operator behavior changes.

Verify package typecheck plus `pnpm env:check`, Compose validation, and parity as applicable.
