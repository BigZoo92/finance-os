<!-- GENERATED — DO NOT EDIT
     Source: .agentic/source/skills/ui-audit/rules/a11y-icon-controls-labeled.md
     Hash:   sha256:554ed113409ca0eb
     Sync:   pnpm agent:skills:sync -->

---
title: Label Icon-Only Controls
impact: HIGH
impactDescription: ensures controls are announced clearly
tags: accessibility, aria-label, controls
---

## Label Icon-Only Controls

Any control with no visible text requires an accessible name.

**Incorrect (no accessible name):**

```tsx
<button onClick={closeModal}>
  <XIcon />
</button>
```

**Correct (explicit label):**

```tsx
<button type="button" aria-label="Close dialog" onClick={closeModal}>
  <XIcon aria-hidden="true" />
</button>
```
