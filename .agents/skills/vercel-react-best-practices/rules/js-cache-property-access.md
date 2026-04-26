<!-- GENERATED — DO NOT EDIT
     Source: .agentic/source/skills/vercel-react-best-practices/rules/js-cache-property-access.md
     Hash:   sha256:73e47431e74878a9
     Sync:   pnpm agent:skills:sync -->

---
title: Cache Property Access in Loops
impact: LOW-MEDIUM
impactDescription: reduces lookups
tags: javascript, loops, optimization, caching
---

## Cache Property Access in Loops

Cache object property lookups in hot paths.

**Incorrect (3 lookups × N iterations):**

```typescript
for (let i = 0; i < arr.length; i++) {
  process(obj.config.settings.value)
}
```

**Correct (1 lookup total):**

```typescript
const value = obj.config.settings.value
const len = arr.length
for (let i = 0; i < len; i++) {
  process(value)
}
```
