<!-- GENERATED — DO NOT EDIT
     Source: .agentic/source/skills/ui-audit/rules/type-readable-scale.md
     Hash:   sha256:273a69ea6af8c2d2
     Sync:   pnpm agent:skills:sync -->

---
title: Set a Readable Type Scale
impact: HIGH
impactDescription: improves scan speed and reading comfort
tags: typography, readability, scale
---

## Set a Readable Type Scale

Use body sizes and weights that stay readable across desktop and mobile.

**Incorrect (too small and too light):**

```css
body {
  font-size: 12px;
  font-weight: 300;
  line-height: 1.2;
}
```

**Correct (readable defaults):**

```css
body {
  font-size: clamp(0.95rem, 0.2vw + 0.9rem, 1.125rem);
  font-weight: 400;
  line-height: 1.45;
}
```
