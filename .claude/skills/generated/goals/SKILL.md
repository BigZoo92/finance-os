<!-- GENERATED — DO NOT EDIT
     Source: .agentic/source/skills/generated/goals/SKILL.md
     Hash:   sha256:d65c7020cfcf6a02
     Sync:   pnpm agent:skills:sync -->

---
name: goals
description: "Skill for the Goals area of finance-os. 8 symbols across 2 files."
---

# Goals

8 symbols | 2 files | Cohesion: 100%

## When to Use

- Working with code in `apps/`
- Understanding how createFinancialGoal, updateFinancialGoal, archiveFinancialGoal work
- Modifying goals-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `apps/web/src/features/goals/api.ts` | performGoalAction, createFinancialGoal, updateFinancialGoal, archiveFinancialGoal, readOnlineState (+1) |
| `apps/web/src/features/goals/action-logger.ts` | readOnlineState, logGoalActionEvent |

## Entry Points

Start here when exploring this area:

- **`createFinancialGoal`** (Function) — `apps/web/src/features/goals/api.ts:115`
- **`updateFinancialGoal`** (Function) — `apps/web/src/features/goals/api.ts:126`
- **`archiveFinancialGoal`** (Function) — `apps/web/src/features/goals/api.ts:144`
- **`normalizeFinancialGoalActionError`** (Function) — `apps/web/src/features/goals/api.ts:18`
- **`logGoalActionEvent`** (Function) — `apps/web/src/features/goals/action-logger.ts:19`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `createFinancialGoal` | Function | `apps/web/src/features/goals/api.ts` | 115 |
| `updateFinancialGoal` | Function | `apps/web/src/features/goals/api.ts` | 126 |
| `archiveFinancialGoal` | Function | `apps/web/src/features/goals/api.ts` | 144 |
| `normalizeFinancialGoalActionError` | Function | `apps/web/src/features/goals/api.ts` | 18 |
| `logGoalActionEvent` | Function | `apps/web/src/features/goals/action-logger.ts` | 19 |
| `performGoalAction` | Function | `apps/web/src/features/goals/api.ts` | 55 |
| `readOnlineState` | Function | `apps/web/src/features/goals/api.ts` | 10 |
| `readOnlineState` | Function | `apps/web/src/features/goals/action-logger.ts` | 2 |

## How to Explore

1. `gitnexus_context({name: "createFinancialGoal"})` — see callers and callees
2. `gitnexus_query({query: "goals"})` — find related execution flows
3. Read key files listed above for implementation details
