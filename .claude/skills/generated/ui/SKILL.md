---
name: ui
description: "Skill for the Ui area of finance-os. 20 symbols across 8 files."
---

# Ui

20 symbols | 8 files | Cohesion: 100%

## When to Use

- Working with code in `packages/`
- Understanding how cn, D3Sparkline work
- Modifying ui-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `packages/ui/src/components/ui/card.tsx` | Card, CardHeader, CardTitle, CardDescription, CardAction (+2) |
| `packages/ui/src/components/ui/avatar.tsx` | Avatar, AvatarImage, AvatarFallback, AvatarBadge, AvatarGroup (+1) |
| `apps/web/src/components/ui/d3-sparkline.tsx` | useContainerWidth, D3Sparkline |
| `packages/ui/src/lib/utils.ts` | cn |
| `packages/ui/src/components/ui/separator.tsx` | Separator |
| `packages/ui/src/components/ui/input.tsx` | Input |
| `packages/ui/src/components/ui/button.tsx` | Button |
| `packages/ui/src/components/ui/badge.tsx` | Badge |

## Entry Points

Start here when exploring this area:

- **`cn`** (Function) — `packages/ui/src/lib/utils.ts:3`
- **`D3Sparkline`** (Function) — `apps/web/src/components/ui/d3-sparkline.tsx:39`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `cn` | Function | `packages/ui/src/lib/utils.ts` | 3 |
| `D3Sparkline` | Function | `apps/web/src/components/ui/d3-sparkline.tsx` | 39 |
| `Separator` | Function | `packages/ui/src/components/ui/separator.tsx` | 5 |
| `Input` | Function | `packages/ui/src/components/ui/input.tsx` | 4 |
| `Card` | Function | `packages/ui/src/components/ui/card.tsx` | 4 |
| `CardHeader` | Function | `packages/ui/src/components/ui/card.tsx` | 17 |
| `CardTitle` | Function | `packages/ui/src/components/ui/card.tsx` | 30 |
| `CardDescription` | Function | `packages/ui/src/components/ui/card.tsx` | 40 |
| `CardAction` | Function | `packages/ui/src/components/ui/card.tsx` | 50 |
| `CardContent` | Function | `packages/ui/src/components/ui/card.tsx` | 63 |
| `CardFooter` | Function | `packages/ui/src/components/ui/card.tsx` | 73 |
| `Button` | Function | `packages/ui/src/components/ui/button.tsx` | 41 |
| `Badge` | Function | `packages/ui/src/components/ui/badge.tsx` | 30 |
| `Avatar` | Function | `packages/ui/src/components/ui/avatar.tsx` | 7 |
| `AvatarImage` | Function | `packages/ui/src/components/ui/avatar.tsx` | 27 |
| `AvatarFallback` | Function | `packages/ui/src/components/ui/avatar.tsx` | 40 |
| `AvatarBadge` | Function | `packages/ui/src/components/ui/avatar.tsx` | 56 |
| `AvatarGroup` | Function | `packages/ui/src/components/ui/avatar.tsx` | 72 |
| `AvatarGroupCount` | Function | `packages/ui/src/components/ui/avatar.tsx` | 85 |
| `useContainerWidth` | Function | `apps/web/src/components/ui/d3-sparkline.tsx` | 20 |

## How to Explore

1. `gitnexus_context({name: "cn"})` — see callers and callees
2. `gitnexus_query({query: "ui"})` — find related execution flows
3. Read key files listed above for implementation details
