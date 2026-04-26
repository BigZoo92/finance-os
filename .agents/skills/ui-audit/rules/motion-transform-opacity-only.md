<!-- GENERATED — DO NOT EDIT
     Source: .agentic/source/skills/ui-audit/rules/motion-transform-opacity-only.md
     Hash:   sha256:1f0e37b3010f0271
     Sync:   pnpm agent:skills:sync -->

---
title: Animate Transform and Opacity, Not Layout
impact: HIGH
impactDescription: reduces jank and improves smoothness
tags: motion, performance, animation
---

## Animate Transform and Opacity, Not Layout

Avoid animating properties that trigger layout/reflow.

**Incorrect (layout-thrashing animation):**

```css
.panel {
  transition: width 220ms ease, left 220ms ease;
}
```

**Correct (compositor-friendly animation):**

```css
.panel {
  transition: transform 220ms ease, opacity 220ms ease;
}
```
