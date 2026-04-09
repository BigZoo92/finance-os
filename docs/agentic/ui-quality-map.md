# UI Quality Map

Use this map when touching dashboard surfaces or shared UI primitives.

## Primary UI Surfaces

- Dashboard shell and major state handling: [../../apps/web/src/routes/_app.tsx](../../apps/web/src/routes/_app.tsx)
- Personal goals surface: [../../apps/web/src/components/dashboard/personal-financial-goals-card.tsx](../../apps/web/src/components/dashboard/personal-financial-goals-card.tsx)
- Powens callback flow UI: [../../apps/web/src/routes/powens/callback.tsx](../../apps/web/src/routes/powens/callback.tsx)
- Shared UI exports: [../../packages/ui/src/components/index.ts](../../packages/ui/src/components/index.ts)

## Quality Bar

- Cover loading, empty, error, and success states in the real layout, not with generic spinner-only placeholders.
- Preserve auth consistency: the first SSR render should not flash demo while admin auth is still resolving.
- Keep hierarchy, spacing rhythm, and accessibility intact. The repo already uses a custom dashboard composition instead of generic equal-card scaffolding; keep that intentionality.
- When a task materially changes palette, theme direction, contrast, or expressive color usage, use `skill.color-expert` before freezing the design.
- Keep dashboard state driven by loaders, query options, and URL search params rather than ad hoc local request state.
- Dashboard health states should stay progressive: one global summary, inline badges only on selected decision-critical widgets, and an optional diagnosis drawer instead of repeating the same warning across the whole page.
- Powens connection status UI should prefer the persisted last-sync snapshot for concise badges, but it must degrade cleanly to runtime-only placeholders when the server kill-switch disables persistence.

## UI Change Expectations

- Add a short UI rationale in the PR summary or change notes.
- Include screenshot notes for meaningful UI changes.
- For medium-high risk changes, include the full state catalog and screenshot matrix from [policy-verification-bundle.md](policy-verification-bundle.md).
- If a shared primitive changes, check both the consuming web page and the package export surface.

## Manual UI Checklist

- Demo mode banner and disabled sensitive actions still read correctly.
- Personal goals stays list-first on load, with the full editor only appearing in the drawer or modal state.
- Personal goals covers loading, empty (`No goals yet`), recoverable error, offline hint, and success toast states without collapsing the surrounding dashboard hierarchy.
- Admin mode still exposes Powens connect/sync affordances without layout regressions.
- Ops overview should keep Powens callback observability compact: show freshness plus safe-mode state without exposing callback payload contents.
- The dashboard health summary should stay coherent across demo/admin: demo comes from the fixture matrix, admin comes from aggregate plus domain-level health, and global vs inline signals must not contradict each other.
- Powens connection cards should use explicit badges (`OK`, `KO`, `En cours`, `Inconnu`), keep the short reason readable in the main card, and reserve the exact last-attempt time for a tooltip or similarly lightweight affordance.
- Empty and error states remain actionable and legible.
- Tables, cards, and buttons stay keyboard accessible.
- Mobile and desktop layouts still load without overflow surprises.
- When the Powens sync cooldown UI guard is enabled, the dashboard should clearly show `Idle -> Syncing -> Cooldown -> Ready`, keep blocked reason text explicit, and still honor demo/admin gating plus the runtime kill-switch.
- Reconnect-required states should surface as a non-blocking inline banner at the top of dashboard with explicit `Reconnecter` and `Plus tard` CTAs, full loading/in-progress/error/deferred state copy, and deterministic demo behavior behind `VITE_UI_RECONNECT_BANNER_ENABLED`.
- Capture screenshots for at least success, degraded fallback, and error/retry states when those states are user-visible in the touched UI.
- Push notifications card should cover permission states (`unknown|denied|granted`), opt-in status, stale subscription recovery CTA, and provider degraded banner while keeping demo deterministic and admin delivery behind `PWA_NOTIFICATIONS_ENABLED` / `PWA_CRITICAL_ENABLED`.
