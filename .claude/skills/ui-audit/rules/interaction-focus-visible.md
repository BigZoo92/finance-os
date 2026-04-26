<!-- GENERATED — DO NOT EDIT
     Source: .agentic/source/skills/ui-audit/rules/interaction-focus-visible.md
     Hash:   sha256:54df8a6f0ccd68a2
     Sync:   pnpm agent:skills:sync -->

---
title: Preserve Visible Focus States
impact: CRITICAL
impactDescription: critical for keyboard operability
tags: interaction, focus, keyboard
---

## Preserve Visible Focus States

Never remove outlines without a clear `:focus-visible` replacement.

**Incorrect (focus removed):**

```css
button:focus {
  outline: none;
}
```

**Correct (high-contrast focus ring):**

```css
button:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
```
