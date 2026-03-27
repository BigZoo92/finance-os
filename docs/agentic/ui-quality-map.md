# UI Quality Map

Use this map when touching dashboard surfaces or shared UI primitives.

## Primary UI Surfaces

- Dashboard shell and major state handling: [../../apps/web/src/components/dashboard/app-shell.tsx](../../apps/web/src/components/dashboard/app-shell.tsx)
- Personal goals surface: [../../apps/web/src/components/dashboard/personal-financial-goals-card.tsx](../../apps/web/src/components/dashboard/personal-financial-goals-card.tsx)
- Powens callback flow UI: [../../apps/web/src/routes/powens/callback.tsx](../../apps/web/src/routes/powens/callback.tsx)
- Shared UI exports: [../../packages/ui/src/components/index.ts](../../packages/ui/src/components/index.ts)

## Quality Bar

- Cover loading, empty, error, and success states in the real layout, not with generic spinner-only placeholders.
- Preserve auth consistency: the first SSR render should not flash demo while admin auth is still resolving.
- Keep hierarchy, spacing rhythm, and accessibility intact. The repo already uses a custom dashboard composition instead of generic equal-card scaffolding; keep that intentionality.
- Keep dashboard state driven by loaders, query options, and URL search params rather than ad hoc local request state.
- Dashboard health states should stay progressive: one global summary, inline badges only on selected decision-critical widgets, and an optional diagnosis drawer instead of repeating the same warning across the whole page.

## UI Change Expectations

- Add a short UI rationale in the PR summary or change notes.
- Include screenshot notes for meaningful UI changes.
- If a shared primitive changes, check both the consuming web page and the package export surface.

## Manual UI Checklist

- Demo mode banner and disabled sensitive actions still read correctly.
- Personal goals stays list-first on load, with the full editor only appearing in the drawer or modal state.
- Personal goals covers loading, empty (`No goals yet`), recoverable error, offline hint, and success toast states without collapsing the surrounding dashboard hierarchy.
- Admin mode still exposes Powens connect/sync affordances without layout regressions.
- Ops overview should keep Powens callback observability compact: show freshness plus safe-mode state without exposing callback payload contents.
- The dashboard health summary should stay coherent across demo/admin: demo comes from the fixture matrix, admin comes from aggregate plus domain-level health, and global vs inline signals must not contradict each other.
- Empty and error states remain actionable and legible.
- Tables, cards, and buttons stay keyboard accessible.
- Mobile and desktop layouts still load without overflow surprises.
- When the Powens sync cooldown UI guard is enabled, the dashboard should clearly show `Idle -> Syncing -> Cooldown -> Ready`, keep blocked reason text explicit, and still honor demo/admin gating plus the runtime kill-switch.
