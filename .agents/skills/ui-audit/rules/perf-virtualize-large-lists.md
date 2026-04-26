<!-- GENERATED — DO NOT EDIT
     Source: .agentic/source/skills/ui-audit/rules/perf-virtualize-large-lists.md
     Hash:   sha256:ec42551768c8793f
     Sync:   pnpm agent:skills:sync -->

---
title: Virtualize Long Lists
impact: HIGH
impactDescription: improves scroll performance and memory usage
tags: performance, lists, virtualization
---

## Virtualize Long Lists

Large lists (roughly >50 visible items) should use virtualization/windowing.

**Incorrect (renders entire dataset):**

```tsx
<ul>
  {items.map(item => <Row key={item.id} item={item} />)}
</ul>
```

**Correct (windowed rendering):**

```tsx
<VirtualizedList
  itemCount={items.length}
  itemSize={48}
  renderItem={(index) => <Row item={items[index]} />}
/>
```
