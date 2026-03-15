# UI Quality Map

Use this map when touching dashboard surfaces or shared UI primitives.

## Primary UI Surfaces

- Dashboard shell and major state handling: [../../apps/web/src/components/dashboard/app-shell.tsx](../../apps/web/src/components/dashboard/app-shell.tsx)
- Powens callback flow UI: [../../apps/web/src/routes/powens/callback.tsx](../../apps/web/src/routes/powens/callback.tsx)
- Shared UI exports: [../../packages/ui/src/components/index.ts](../../packages/ui/src/components/index.ts)

## Quality Bar

- Cover loading, empty, error, and success states in the real layout, not with generic spinner-only placeholders.
- Preserve auth consistency: the first SSR render should not flash demo while admin auth is still resolving.
- Keep hierarchy, spacing rhythm, and accessibility intact. The repo already uses a custom dashboard composition instead of generic equal-card scaffolding; keep that intentionality.
- Keep dashboard state driven by loaders, query options, and URL search params rather than ad hoc local request state.

## UI Change Expectations

- Add a short UI rationale in the PR summary or change notes.
- Include screenshot notes for meaningful UI changes.
- If a shared primitive changes, check both the consuming web page and the package export surface.

## Manual UI Checklist

- Demo mode banner and disabled sensitive actions still read correctly.
- Admin mode still exposes Powens connect/sync affordances without layout regressions.
- Empty and error states remain actionable and legible.
- Tables, cards, and buttons stay keyboard accessible.
- Mobile and desktop layouts still load without overflow surprises.
