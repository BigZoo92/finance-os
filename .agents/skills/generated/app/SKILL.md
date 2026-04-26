<!-- GENERATED — DO NOT EDIT
     Source: .agentic/source/skills/generated/app/SKILL.md
     Hash:   sha256:37318c2e2630bcaa
     Sync:   pnpm agent:skills:sync -->

---
name: app
description: "Skill for the _app area of finance-os. 8 symbols across 4 files."
---

# _app

8 symbols | 4 files | Cohesion: 100%

## When to Use

- Working with code in `apps/`
- Understanding how resolveRange, PatrimoinePage, resolveRange work
- Modifying _app-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `apps/web/src/routes/_app/patrimoine.tsx` | resolveRange, PatrimoinePage |
| `apps/web/src/routes/_app/investissements.tsx` | resolveRange, InvestissementsPage |
| `apps/web/src/routes/_app/index.tsx` | resolveRange, CockpitPage |
| `apps/web/src/routes/_app/depenses.tsx` | resolveRange, DepensesPage |

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `resolveRange` | Function | `apps/web/src/routes/_app/patrimoine.tsx` | 16 |
| `PatrimoinePage` | Function | `apps/web/src/routes/_app/patrimoine.tsx` | 42 |
| `resolveRange` | Function | `apps/web/src/routes/_app/investissements.tsx` | 16 |
| `InvestissementsPage` | Function | `apps/web/src/routes/_app/investissements.tsx` | 35 |
| `resolveRange` | Function | `apps/web/src/routes/_app/index.tsx` | 18 |
| `CockpitPage` | Function | `apps/web/src/routes/_app/index.tsx` | 42 |
| `resolveRange` | Function | `apps/web/src/routes/_app/depenses.tsx` | 25 |
| `DepensesPage` | Function | `apps/web/src/routes/_app/depenses.tsx` | 55 |

## How to Explore

1. `gitnexus_context({name: "resolveRange"})` — see callers and callees
2. `gitnexus_query({query: "_app"})` — find related execution flows
3. Read key files listed above for implementation details
