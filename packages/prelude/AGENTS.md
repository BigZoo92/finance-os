# Prelude instructions

Scope: `packages/prelude/**`.

- Keep helpers low-level, predictable, side-effect-light, and reusable across runtimes.
- Do not move finance rules, provider knowledge, or UI behavior here.
- Shared errors and runtime payloads must remain normalized and safe; contract changes update every consumer.
- Run GitNexus impact before changing widely imported helpers.

Verify package typecheck and affected API/web/worker tests.
