<!-- GENERATED — DO NOT EDIT
     Source: .agentic/source/skills/ui-audit/rules/layout-empty-loading-error-states.md
     Hash:   sha256:5295ed3cfaabad01
     Sync:   pnpm agent:skills:sync -->

---
title: Design Empty, Loading, and Error States Explicitly
impact: HIGH
impactDescription: improves task continuity in edge conditions
tags: layout, states, ux
---

## Design Empty, Loading, and Error States Explicitly

Every primary surface should define behavior for no data, loading, and failure.

**Incorrect (missing fallback states):**

```tsx
return <ResultsList items={data.items} />
```

**Correct (state-aware rendering):**

```tsx
if (isLoading) return <ResultsSkeleton />
if (error) return <ErrorState retry={refetch} />
if (data.items.length === 0) return <EmptyState />
return <ResultsList items={data.items} />
```
