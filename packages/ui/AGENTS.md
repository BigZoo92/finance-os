# UI package instructions

Scope: `packages/ui/**`.

- Read `DESIGN.md`; this package owns reusable primitives and the shared Command Pixel token layer.
- Keep components accessible, keyboard-usable, SSR-safe, and free of app queries/auth/business rules.
- Reuse/extend tokens before introducing values. Geist is the canonical typography direction; `.font-financial` and semantic financial colors remain stable APIs.
- Preserve exported names or update every consumer in the same change.

Verify package typecheck and `pnpm web:build`; add screenshot/accessibility evidence for visible changes.
