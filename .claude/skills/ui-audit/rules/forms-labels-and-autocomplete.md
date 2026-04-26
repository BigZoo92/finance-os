<!-- GENERATED — DO NOT EDIT
     Source: .agentic/source/skills/ui-audit/rules/forms-labels-and-autocomplete.md
     Hash:   sha256:53154b9896beb05b
     Sync:   pnpm agent:skills:sync -->

---
title: Label Inputs and Set Autocomplete Metadata
impact: CRITICAL
impactDescription: improves completion and assistive support
tags: forms, labels, autocomplete
---

## Label Inputs and Set Autocomplete Metadata

Inputs require explicit labels and appropriate `type`, `name`, and `autocomplete` values.

**Incorrect (placeholder-only label):**

```tsx
<input placeholder="Email" />
```

**Correct (explicit label + metadata):**

```tsx
<label htmlFor="email">Email</label>
<input
  id="email"
  name="email"
  type="email"
  autoComplete="email"
  inputMode="email"
/>
```
