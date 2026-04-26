<!-- GENERATED — DO NOT EDIT
     Source: .agentic/source/skills/ui-audit/rules/perf-image-dimensions-and-priority.md
     Hash:   sha256:da76272de4ed1f39
     Sync:   pnpm agent:skills:sync -->

---
title: Set Image Dimensions and Priority Intentionally
impact: CRITICAL
impactDescription: prevents layout shift and improves LCP
tags: performance, images, cls, lcp
---

## Set Image Dimensions and Priority Intentionally

Declare `width`/`height` (or aspect ratio) and prioritize only above-the-fold hero images.

**Incorrect (layout shift risk):**

```tsx
<img src="/hero.jpg" alt="Product screenshot" />
```

**Correct (stable image rendering):**

```tsx
<Image
  src="/hero.jpg"
  alt="Product screenshot"
  width={1600}
  height={900}
  priority
/>
```
