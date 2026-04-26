<!-- GENERATED — DO NOT EDIT
     Source: .agentic/source/skills/typography-audit/rules/spacing-subhead-proximity.md
     Hash:   sha256:25ef8ee4bf62a822
     Sync:   pnpm agent:skills:sync -->

---
title: Place Subheadings Closer to Following Content
impact: HIGH
tags: subheadings, proximity, whitespace, visual-grouping
---

## Place Subheadings Closer to Following Content

A subheading should have more space above it (separating from previous content) than below it (connecting to the content it introduces). This proximity principle groups the heading with its section. Use extra spacing above large subheaders.

**Incorrect (equal spacing, heading floats between sections):**

```css
h2 {
  margin-top: 1.5rem;
  margin-bottom: 1.5rem;
}
```

**Correct (more space above, less below):**

```css
h2 {
  margin-top: 2.5rem;
  margin-bottom: 0.75rem;
}

h3 {
  margin-top: 2rem;
  margin-bottom: 0.5rem;
}
```

The larger the heading, the more top margin it needs to establish visual separation from the preceding section.
