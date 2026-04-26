<!-- GENERATED — DO NOT EDIT
     Source: .agentic/source/skills/ui-audit/rules/a11y-semantic-html-first.md
     Hash:   sha256:2de91e86d4a6eac1
     Sync:   pnpm agent:skills:sync -->

---
title: Prefer Native Semantics Before ARIA
impact: CRITICAL
impactDescription: improves assistive technology compatibility
tags: accessibility, semantics, aria
---

## Prefer Native Semantics Before ARIA

Use semantic HTML controls first; only add ARIA when native elements cannot express intent.

**Incorrect (clickable div):**

```tsx
<div onClick={submitForm}>Save</div>
```

**Correct (semantic button):**

```tsx
<button type="button" onClick={submitForm}>Save</button>
```
