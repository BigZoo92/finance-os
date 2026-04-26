<!-- GENERATED — DO NOT EDIT
     Source: .agentic/source/skills/finance-os/ui-cockpit/SKILL.md
     Hash:   sha256:ca809475e79f1bf2
     Sync:   pnpm agent:skills:sync -->

---
name: finance-os-ui-cockpit
description: "Finance-OS UI cockpit conventions — luxury dark-first dashboard identity, component states, motion rules, anti-patterns. Use when building or modifying any UI component, page, or visual element."
---

# Finance-OS UI Cockpit

## When to use
- Building or modifying any UI component
- Adding new dashboard widgets or pages
- Working on animations or micro-interactions
- Reviewing UI for design system compliance
- Making color, typography, or spacing decisions

## When NOT to use
- API-only or worker-only changes
- Pure backend logic with no UI impact

**Always read first**: [DESIGN.md](DESIGN.md) and [docs/frontend/design-system.md](docs/frontend/design-system.md)

---

## 1. Visual Identity

Finance-OS is a **luxury personal finance cockpit** — elegant, precise, professional. Not generic SaaS.

**Dark mode is default**. Background: `oklch(0.13 0.015 260)` (navy-slate, not pure black). Text: warm white (not pure white). Primary accent: amber/gold `oklch(0.78 0.155 75)`.

### Palette (OKLch)

| Token | Dark | Light | Usage |
|---|---|---|---|
| Background | `oklch(0.13 0.015 260)` | `oklch(0.98 0.004 75)` | Page bg |
| Card | `oklch(0.17 0.012 260)` | `oklch(1 0 0)` | Card surfaces |
| Primary | `oklch(0.78 0.155 75)` | `oklch(0.62 0.17 70)` | Amber/gold accent |
| Positive | Emerald-500 | Emerald-600 | Revenue, gains |
| Negative | Coral | Rose-500 | Expenses, losses |
| Warning | Amber | Amber-600 | Alerts, caution |

---

## 2. Typography

- **Body/titles**: Inter Variable (`cv11`, `ss01`, `ss03`)
- **Financial amounts**: JetBrains Mono Variable with `.font-financial` class (tabular figures: `tnum`, `zero`)
- Strong typographic hierarchy via size/weight/spacing — not borders or dividers

---

## 3. Required Component States

Every data-driven component MUST implement all 7 states:

```tsx
// Pattern: complete state handling
function Widget({ data, status, mode }: WidgetProps) {
  if (mode === 'demo' && isAdminOnly) return <GatedState />;
  if (status === 'offline') return <OfflineState cachedData={cached} />;
  if (status === 'loading') return <WidgetSkeleton />;
  if (status === 'error') return <ErrorState onRetry={refetch} />;
  if (!data || data.length === 0) return <EmptyState />;
  if (status === 'degraded') return <DegradedState data={data} source={source} />;
  return <WidgetContent data={data} />;
}
```

| State | Implementation |
|---|---|
| `loading` | Skeleton matching content layout (not a spinner) |
| `success` | Full data render |
| `empty` | Illustration + contextual message |
| `degraded` | Data + source badge ("cached", "demo") |
| `error` | Error boundary + retry button |
| `offline` | Cached data + offline indicator |
| `gated` | Lock icon + "admin only" message |

---

## 4. Motion Rules

### Allowed
- Page enter: fade + translateY (250ms, ease-out-expo)
- Navigation indicator: spring `layoutId`
- Progress bars: animated width + gradient
- Button press: `scale(0.97)` on active
- Card hover: subtle shadow lift
- Micro-interactions that signal state changes

### Timing
- Fast: 120ms (hover, active)
- Normal: 200ms (transitions)
- Slow: 350ms (complex reveals)
- Enter: 250ms / Exit: 180ms

### Forbidden
- Stagger animations on lists
- Parallax effects
- SVG morphing
- Auto-play animation loops
- Scroll-jacking
- Any animation that blocks interaction

---

## 5. Layout

- Desktop: 240px sidebar (68px collapsed) + main `max-w-7xl`
- Mobile: hidden sidebar, 5-item bottom nav + drawer
- Touch targets: minimum 44px
- Safe area respected on mobile
- Grid: 1 col (default) → 2 (sm) → 2 (lg) → 4 (xl)
- Spacing: 4px base unit. Cards: `py-6 px-6`. Sections: `space-y-8`

---

## 6. Components

Built on shadcn/ui "new-york" + Radix + CVA:
- `data-slot` attributes on all sub-elements
- `cn()` utility for class merging
- Button: 6 variants x 7 sizes
- Card: Header/Title/Description/Action/Content/Footer
- Badge: 6 variants, `rounded-full` for pills

### Data Visualization
- D3.js for charts (no third-party chart libs)
- Custom `D3Sparkline` with tooltip, crosshair, gradient fill
- `MiniSparkline` for inline mini charts
- Curve: `curveCatmullRom` (smooth, natural)
- Chart palette: 7 harmonious colors (`chart-1` through `chart-7`)

---

## 7. ASCII Accents

Decorative glyphs as visual punctuation: `◈ ↔ ◆ △ ◎ ▣ ⊞ ⚙ ♡`

Components: `AsciiLogo`, `AsciiDivider`, `AsciiFrame`, `AsciiStatusLine`, `SectionGlyph`

**Rule**: Use sparingly for identity. Never forced or excessive.

---

## Anti-Patterns (NEVER do these)

- Generic SaaS/admin template aesthetic
- AI slop (bland gradients, generic illustrations, cookie-cutter layouts)
- Pure black (`#000`) or pure white (`#fff`) backgrounds in dark mode
- Blue as primary color (amber/gold is the signature hue)
- Blocking animations that delay content
- Adding chart/UI libraries without justification (D3 + shadcn are sufficient)
- Forced ASCII accents (use only where they add character)
- Borders/dividers instead of whitespace for separation

## Common Mistakes

1. **Missing empty/error/degraded states** — shows blank area or generic error
2. **Using wrong font for amounts** — must use `.font-financial` (JetBrains Mono)
3. **Stagger animations** — explicitly forbidden in DESIGN.md
4. **Pure black background** — use navy-slate `oklch(0.13 0.015 260)`
5. **Blue primary accent** — Finance-OS uses amber/gold, not blue
6. **Not testing mobile layout** — bottom nav + drawer, not sidebar

## References
- [DESIGN.md](DESIGN.md) — visual system source of truth
- [DESIGN-DIRECTION.md](docs/context/DESIGN-DIRECTION.md) — extended direction
- [docs/frontend/design-system.md](docs/frontend/design-system.md) — tokens and patterns
- [docs/frontend/motion-and-interactions.md](docs/frontend/motion-and-interactions.md) — motion spec
- [docs/frontend/information-architecture.md](docs/frontend/information-architecture.md) — page structure
