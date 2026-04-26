---
name: shell
description: "Skill for the Shell area of finance-os. 7 symbols across 2 files."
---

# Shell

7 symbols | 2 files | Cohesion: 100%

## When to Use

- Working with code in `apps/`
- Understanding how useTheme, toggle, ThemeToggle work
- Modifying shell-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `apps/web/src/components/shell/theme-toggle.tsx` | getStoredTheme, applyTheme, useTheme, toggle, ThemeToggle |
| `apps/web/src/components/shell/command-palette.tsx` | CommandPalette, handleSelect |

## Entry Points

Start here when exploring this area:

- **`useTheme`** (Function) — `apps/web/src/components/shell/theme-toggle.tsx:21`
- **`toggle`** (Function) — `apps/web/src/components/shell/theme-toggle.tsx:30`
- **`ThemeToggle`** (Function) — `apps/web/src/components/shell/theme-toggle.tsx:39`
- **`CommandPalette`** (Function) — `apps/web/src/components/shell/command-palette.tsx:17`
- **`handleSelect`** (Function) — `apps/web/src/components/shell/command-palette.tsx:33`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `useTheme` | Function | `apps/web/src/components/shell/theme-toggle.tsx` | 21 |
| `toggle` | Function | `apps/web/src/components/shell/theme-toggle.tsx` | 30 |
| `ThemeToggle` | Function | `apps/web/src/components/shell/theme-toggle.tsx` | 39 |
| `CommandPalette` | Function | `apps/web/src/components/shell/command-palette.tsx` | 17 |
| `handleSelect` | Function | `apps/web/src/components/shell/command-palette.tsx` | 33 |
| `getStoredTheme` | Function | `apps/web/src/components/shell/theme-toggle.tsx` | 4 |
| `applyTheme` | Function | `apps/web/src/components/shell/theme-toggle.tsx` | 9 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ThemeToggle → GetStoredTheme` | intra_community | 3 |
| `ThemeToggle → ApplyTheme` | intra_community | 3 |

## How to Explore

1. `gitnexus_context({name: "useTheme"})` — see callers and callees
2. `gitnexus_query({query: "shell"})` — find related execution flows
3. Read key files listed above for implementation details
