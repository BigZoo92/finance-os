<!-- GENERATED — DO NOT EDIT
     Source: .agentic/source/skills/ui-audit/rules/nav-semantic-links.md
     Hash:   sha256:ece91f3f1ac8d6c7
     Sync:   pnpm agent:skills:sync -->

---
title: Use Semantic Links for Navigation
impact: HIGH
impactDescription: preserves expected browser behavior
tags: navigation, semantics, links
---

## Use Semantic Links for Navigation

Navigation should use `<a>` or framework `<Link>` components, not click handlers on generic elements.

**Incorrect (non-semantic navigation):**

```tsx
<div onClick={() => router.push('/settings')}>Settings</div>
```

**Correct (semantic navigation):**

```tsx
<Link href="/settings">Settings</Link>
```
