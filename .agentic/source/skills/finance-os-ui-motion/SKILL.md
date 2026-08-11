---
name: finance-os-ui-motion
description: Add or review purposeful motion in Finance-OS without harming readability, performance, or reduced-motion users. Use for transitions, animated charts, loaders, gestures, micro-interactions, or motion tokens.
---

# UI motion

Read the motion section in `DESIGN.md`. Motion explains state or continuity; it is not a decoration quota.

## Rules

- Prefer opacity and transform; avoid layout-triggering animation on dense financial surfaces.
- Use existing duration/easing tokens and one coherent motion grammar.
- Animate state changes, navigation continuity, disclosure, and direct manipulation only when it improves comprehension.
- Charts may reveal or update, but values and comparisons must be readable immediately without waiting for animation.
- No scroll-jacking, autoplay spectacle, cursor followers, repeated ambient loops, or large staggered lists.
- Interruptions and rapid repeated actions must settle deterministically without queued animation debt.
- Under `prefers-reduced-motion`, remove nonessential movement and replace spatial transitions with immediate or opacity-only state changes.

## Verification

Test first render, repeat action, reversal/interruption, slow device conditions, hidden tab/resume, keyboard flow, and reduced motion. Inspect for layout shift, dropped frames, delayed interaction, and stale animated values.
