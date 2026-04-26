<!-- GENERATED — DO NOT EDIT
     Source: .agentic/source/skills/vercel-react-best-practices/rules/rendering-hydration-suppress-warning.md
     Hash:   sha256:915bacb934e2927d
     Sync:   pnpm agent:skills:sync -->

---
title: Suppress Expected Hydration Mismatches
impact: LOW-MEDIUM
impactDescription: avoids noisy hydration warnings for known differences
tags: rendering, hydration, ssr, nextjs
---

## Suppress Expected Hydration Mismatches

In SSR frameworks (e.g., Next.js), some values are intentionally different on server vs client (random IDs, dates, locale/timezone formatting). For these *expected* mismatches, wrap the dynamic text in an element with `suppressHydrationWarning` to prevent noisy warnings. Do not use this to hide real bugs. Don’t overuse it.

**Incorrect (known mismatch warnings):**

```tsx
function Timestamp() {
  return <span>{new Date().toLocaleString()}</span>
}
```

**Correct (suppress expected mismatch only):**

```tsx
function Timestamp() {
  return (
    <span suppressHydrationWarning>
      {new Date().toLocaleString()}
    </span>
  )
}
```
