<!-- GENERATED — DO NOT EDIT
     Source: .agentic/source/skills/generated/mocks/SKILL.md
     Hash:   sha256:55f481e2857e77f9
     Sync:   pnpm agent:skills:sync -->

---
name: mocks
description: "Skill for the Mocks area of finance-os. 16 symbols across 5 files."
---

# Mocks

16 symbols | 5 files | Cohesion: 100%

## When to Use

- Working with code in `apps/`
- Understanding how getDashboardSummaryMock, hashString, normalizeProfile work
- Modifying mocks-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `apps/api/src/mocks/dashboardSummary.mock.ts` | toMoney, toDateOnly, getRangeStartDate, listDatesInRange, buildDailyWealthSnapshots (+1) |
| `apps/api/src/mocks/demo-scenario-library.ts` | hashString, normalizeProfile, matchPersonaScenario |
| `apps/api/src/mocks/dashboardAnalytics.mock.ts` | toDateOnly, getRangeStartDate, getDashboardAnalyticsMockTransactions |
| `apps/api/src/mocks/transactions.mock.ts` | isBeforeCursor, getDashboardTransactionsMock |
| `apps/api/src/mocks/demo-transactions-fixture.ts` | readFixtureItems, resolveDemoTransactionsFixture |

## Entry Points

Start here when exploring this area:

- **`getDashboardSummaryMock`** (Function) — `apps/api/src/mocks/dashboardSummary.mock.ts:59`
- **`hashString`** (Function) — `apps/api/src/mocks/demo-scenario-library.ts:55`
- **`normalizeProfile`** (Function) — `apps/api/src/mocks/demo-scenario-library.ts:66`
- **`matchPersonaScenario`** (Function) — `apps/api/src/mocks/demo-scenario-library.ts:79`
- **`getDashboardAnalyticsMockTransactions`** (Function) — `apps/api/src/mocks/dashboardAnalytics.mock.ts:94`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `getDashboardSummaryMock` | Function | `apps/api/src/mocks/dashboardSummary.mock.ts` | 59 |
| `hashString` | Function | `apps/api/src/mocks/demo-scenario-library.ts` | 55 |
| `normalizeProfile` | Function | `apps/api/src/mocks/demo-scenario-library.ts` | 66 |
| `matchPersonaScenario` | Function | `apps/api/src/mocks/demo-scenario-library.ts` | 79 |
| `getDashboardAnalyticsMockTransactions` | Function | `apps/api/src/mocks/dashboardAnalytics.mock.ts` | 94 |
| `getDashboardTransactionsMock` | Function | `apps/api/src/mocks/transactions.mock.ts` | 222 |
| `resolveDemoTransactionsFixture` | Function | `apps/api/src/mocks/demo-transactions-fixture.ts` | 333 |
| `toMoney` | Function | `apps/api/src/mocks/dashboardSummary.mock.ts` | 17 |
| `toDateOnly` | Function | `apps/api/src/mocks/dashboardSummary.mock.ts` | 19 |
| `getRangeStartDate` | Function | `apps/api/src/mocks/dashboardSummary.mock.ts` | 21 |
| `listDatesInRange` | Function | `apps/api/src/mocks/dashboardSummary.mock.ts` | 27 |
| `buildDailyWealthSnapshots` | Function | `apps/api/src/mocks/dashboardSummary.mock.ts` | 40 |
| `toDateOnly` | Function | `apps/api/src/mocks/dashboardAnalytics.mock.ts` | 86 |
| `getRangeStartDate` | Function | `apps/api/src/mocks/dashboardAnalytics.mock.ts` | 88 |
| `isBeforeCursor` | Function | `apps/api/src/mocks/transactions.mock.ts` | 206 |
| `readFixtureItems` | Function | `apps/api/src/mocks/demo-transactions-fixture.ts` | 261 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `BuildDailyWealthSnapshots → ToDateOnly` | intra_community | 4 |

## How to Explore

1. `gitnexus_context({name: "getDashboardSummaryMock"})` — see callers and callees
2. `gitnexus_query({query: "mocks"})` — find related execution flows
3. Read key files listed above for implementation details
