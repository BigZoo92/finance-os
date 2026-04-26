<!-- GENERATED — DO NOT EDIT
     Source: .agentic/source/skills/ui-audit/rules/interaction-target-size.md
     Hash:   sha256:0c4934b7acab2225
     Sync:   pnpm agent:skills:sync -->

---
title: Meet Minimum Hit Target Size
impact: HIGH
impactDescription: reduces mistaps on touch devices
tags: interaction, touch, targets
---

## Meet Minimum Hit Target Size

Tap targets should be at least 24px (44px preferred on mobile).

**Incorrect (small tap area):**

```css
.icon-button {
  width: 18px;
  height: 18px;
}
```

**Correct (expanded hit area):**

```css
.icon-button {
  min-width: 44px;
  min-height: 44px;
  display: inline-grid;
  place-items: center;
}
```
