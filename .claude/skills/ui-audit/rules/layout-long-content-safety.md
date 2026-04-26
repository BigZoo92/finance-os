<!-- GENERATED — DO NOT EDIT
     Source: .agentic/source/skills/ui-audit/rules/layout-long-content-safety.md
     Hash:   sha256:fe1b4a3204603880
     Sync:   pnpm agent:skills:sync -->

---
title: Handle Long and Unbroken Content Safely
impact: HIGH
impactDescription: prevents overflow and broken layouts
tags: layout, overflow, truncation
---

## Handle Long and Unbroken Content Safely

Protect UI against long names, URLs, and dense content blocks.

**Incorrect (overflow risk):**

```css
.card-title {
  white-space: nowrap;
}
```

**Correct (safe truncation/wrapping):**

```css
.card {
  min-width: 0;
}
.card-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-body {
  overflow-wrap: anywhere;
}
```
