---
name: logging
description: "Skill for the Logging area of finance-os. 9 symbols across 1 files."
---

# Logging

9 symbols | 1 files | Cohesion: 80%

## When to Use

- Working with code in `packages/`
- Understanding how redactString, isPlainObject, redactByKey work
- Modifying logging-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `packages/prelude/src/logging/json-logger.ts` | redactString, isPlainObject, redactByKey, toSerializableValue, toErrorLogFields (+4) |

## Entry Points

Start here when exploring this area:

- **`redactString`** (Function) — `packages/prelude/src/logging/json-logger.ts:29`
- **`isPlainObject`** (Function) — `packages/prelude/src/logging/json-logger.ts:37`
- **`redactByKey`** (Function) — `packages/prelude/src/logging/json-logger.ts:41`
- **`toSerializableValue`** (Function) — `packages/prelude/src/logging/json-logger.ts:89`
- **`toErrorLogFields`** (Function) — `packages/prelude/src/logging/json-logger.ts:148`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `redactString` | Function | `packages/prelude/src/logging/json-logger.ts` | 29 |
| `isPlainObject` | Function | `packages/prelude/src/logging/json-logger.ts` | 37 |
| `redactByKey` | Function | `packages/prelude/src/logging/json-logger.ts` | 41 |
| `toSerializableValue` | Function | `packages/prelude/src/logging/json-logger.ts` | 89 |
| `toErrorLogFields` | Function | `packages/prelude/src/logging/json-logger.ts` | 148 |
| `toConfiguredLogLevel` | Function | `packages/prelude/src/logging/json-logger.ts` | 76 |
| `shouldLog` | Function | `packages/prelude/src/logging/json-logger.ts` | 85 |
| `writeLogLine` | Function | `packages/prelude/src/logging/json-logger.ts` | 104 |
| `createJsonLogger` | Function | `packages/prelude/src/logging/json-logger.ts` | 118 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `CreateJsonLogger → RedactString` | cross_community | 4 |
| `CreateJsonLogger → IsPlainObject` | cross_community | 4 |

## How to Explore

1. `gitnexus_context({name: "redactString"})` — see callers and callees
2. `gitnexus_query({query: "logging"})` — find related execution flows
3. Read key files listed above for implementation details
