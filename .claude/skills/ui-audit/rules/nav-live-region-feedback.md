<!-- GENERATED — DO NOT EDIT
     Source: .agentic/source/skills/ui-audit/rules/nav-live-region-feedback.md
     Hash:   sha256:758a42893f28788a
     Sync:   pnpm agent:skills:sync -->

---
title: Announce Status Changes with Live Regions
impact: HIGH
impactDescription: makes async feedback perceivable to assistive tech
tags: navigation, feedback, aria-live
---

## Announce Status Changes with Live Regions

Toasts and validation summaries should use polite live regions unless interruption is critical.

**Incorrect (visual-only toast):**

```tsx
<div className="toast">Saved</div>
```

**Correct (announced toast):**

```tsx
<div role="status" aria-live="polite" className="toast">
  Changes saved
</div>
```
