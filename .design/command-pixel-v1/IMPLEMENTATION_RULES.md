# Implementation Rules

## Freeze rule

Command Pixel V1 is visually frozen.

Implementation should reproduce and systematize the final design. It should not start a new visual exploration.

## Preserve business behavior

A visual refactor is not permission to rewrite working business logic.

Keep existing routes, data sources, financial semantics and provider behavior unless a specific implementation task requires a product change.

## Canonical data honesty

- Unknown is not zero
- Unavailable P&L is not zero percent
- Unavailable value is not zero euros
- Estimated, stale, manual and unresolved states remain explicit
- P&L is shown only when cost basis is known
- Do not invent cashflow adjusted performance if the product does not have reliable data for it

## Provider security

IBKR and Binance are configured through server environment variables.

Never add UI for:

- API keys
- API secrets
- Flex tokens
- Query IDs
- credential reveal
- credential editing

Powens may keep user facing connect, reconnect, sync and disconnect behavior where supported.

## Component first implementation

Do not copy page specific CSS for every screen.

Build reusable primitives for:

- shell
- navigation
- surfaces
- controls
- financial amounts
- status
- freshness
- tables
- overlays
- loading and degraded states

Then compose pages from them.

## Responsive

Do not compress desktop layouts mechanically.

Use intentional mobile transformations, especially for tables, drawers, charts and dense Ops surfaces.

## Accessibility

Required across the system:

- strong contrast
- visible keyboard focus
- keyboard accessible overlays
- sufficient hit targets
- states not conveyed through color alone
- accessible chart alternatives
- reduced motion
- readable financial values

## Performance

Heavy visual effects are reserved for signature experiences.

Allowed signature pages:

- Login
- Radar
- Mémoire 3D

Other pages should remain lightweight and achieve quality through layout, typography and interaction rather than GPU heavy decoration.

## ReactBits and PixelBlast

Do not reintroduce ReactBits.

PixelBlast is removed from Login and should not be replaced by another generic particle effect.

## Dead visual code

After migration, remove:

- old design tokens
- rejected palette variables
- obsolete shell code
- dead CSS
- orphaned components
- unused imports
- old ReactBits code
- PixelBlast
- obsolete page specific primitives duplicated by the new shared system

Only remove code after verifying it has no remaining product use.
