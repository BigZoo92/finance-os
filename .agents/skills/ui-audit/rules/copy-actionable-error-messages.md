<!-- GENERATED — DO NOT EDIT
     Source: .agentic/source/skills/ui-audit/rules/copy-actionable-error-messages.md
     Hash:   sha256:3f119703ff8e922e
     Sync:   pnpm agent:skills:sync -->

---
title: Make Error Messages Actionable
impact: HIGH
impactDescription: reduces repeated failure loops
tags: copy, errors, ux
---

## Make Error Messages Actionable

Error messages should include what failed and what to do next.

**Incorrect (problem only):**

```tsx
<p>Something went wrong.</p>
```

**Correct (problem + next step):**

```tsx
<p>Upload failed. Check your connection and try again.</p>
```
