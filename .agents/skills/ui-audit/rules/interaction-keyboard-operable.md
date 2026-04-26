<!-- GENERATED — DO NOT EDIT
     Source: .agentic/source/skills/ui-audit/rules/interaction-keyboard-operable.md
     Hash:   sha256:860badc6234993d1
     Sync:   pnpm agent:skills:sync -->

---
title: Ensure Full Keyboard Operability
impact: CRITICAL
impactDescription: enables non-pointer users to complete tasks
tags: interaction, keyboard, operability
---

## Ensure Full Keyboard Operability

Pointer-only handlers are not acceptable for critical actions.

**Incorrect (mouse only):**

```tsx
<div onClick={openMenu}>Open menu</div>
```

**Correct (keyboard + pointer by default):**

```tsx
<button type="button" onClick={openMenu}>Open menu</button>
```
