# Finance-OS Design

## Status

Finance-OS Command Pixel V1 is the locked and canonical product design.

Design status: **FINAL**. Implementation status: **IMPLEMENTED**.

Do not reopen the visual direction during implementation.

The detailed design handoff lives in:

`.design/command-pixel-v1/`

Before any significant UI work, read:

1. `.design/command-pixel-v1/README.md`
2. `.design/command-pixel-v1/DESIGN_SYSTEM.md`
3. `.design/command-pixel-v1/COPY_RULES.md`
4. `.design/command-pixel-v1/ROUTE_MAP.md`
5. `.design/command-pixel-v1/IMPLEMENTATION_RULES.md`

The canonical Claude Design source is:

`.design/command-pixel-v1/canonical/source/Finance-OS Command Pixel V1.dc.html`

The files in `.design/command-pixel-v1/` take precedence over older screenshots, explorations, Stitch outputs, legacy design notes, and previous visual directions.

## Command Pixel V1

Finance-OS is a premium personal financial operating system.

The visual balance is:

- contemporary premium product first
- subtle software nostalgia second
- financial clarity before decoration
- strong personality without visual noise

The product should feel precise, calm, crafted, warm, data-driven, and personal.

It must not feel like:

- a generic SaaS dashboard
- a trading terminal
- a developer console
- a crypto product
- a cyberpunk interface
- an AI dashboard
- a retro computer simulation
- a marketing landing page

Precision wins over decoration.

## Visual direction

The canonical palette is:

### Soft Orange Cream

Use:

- warm graphite and charcoal for dark foundations
- brown-black for deeper surfaces
- cream and warm off-white for primary text
- orange as the main Finance-OS signature accent
- green for genuinely positive financial states
- amber for attention
- coral for genuine negative or error states
- restrained teal or cyan only when it improves information hierarchy

Do not introduce a new global accent color.

Do not use purple as a generic AI identity.

Do not create isolated page-specific palettes.

Dark mode is the primary canonical experience.

Light mode must be designed natively with warm cream foundations and graphite typography. It must not be a mechanical inversion of dark mode.

## Typography lock

Use only the Geist family.

### Geist Sans

Dominant UI family.

Use for:

- navigation
- titles
- labels
- body copy
- controls
- buttons
- recommendations
- forms
- tables

### Geist Mono

Use selectively for:

- financial amounts
- percentages
- dates
- compact metadata
- operational durations
- numeric values

### Geist Pixel

Use extremely rarely.

Valid uses include:

- tiny loading details
- signature micro-labels
- selected state accents
- rare Command Pixel moments

Never use Geist Pixel for paragraphs or normal interface copy.

Do not introduce another font family.

Existing Inter, JetBrains, or other legacy declarations are migration debt.

`.font-financial` may remain during migration if existing financial components depend on it, but its final visual output must conform to the Geist system.

## Global copy system

Finance-OS uses extremely low-noise copy.

The interface should show:

- data first
- action first
- status first
- explanation only when required

If text does not help the user understand, decide, act, or identify an important state, remove it.

Whitespace is preferable to filler.

### Forbidden characters in user-facing UI copy

Never use:

- middle dot
- em dash
- semicolon

Do not use decorative punctuation as a metadata separator.

Prefer:

- spacing
- columns
- separate labels
- line breaks
- commas
- colons
- parentheses

### Avoid

- AI-style commentary
- filler explanations
- decorative system prose
- fake intelligence language
- technical narration
- redundant subtitles
- generic motivational copy
- explanations that simply restate visible data

Finance-OS should feel intelligent because the right information appears at the right time.

It should not narrate its intelligence.

## Shell

The desktop shell is locked.

The top navbar must be:

- contained
- floating
- centered
- visually detached from the viewport edges
- separated from the top of the page
- low radius
- premium and restrained
- built with Geist Sans labels

Do not create a full-width navbar.

Do not attach the navbar directly to the top edge.

Do not introduce a permanent desktop sidebar.

Dropdowns must be:

- detached from the navbar
- visually floating
- low radius
- clearly structured
- built with framed icon tiles
- consistent across navigation groups

Hover and persistent active states must remain visually distinct.

Do not use brackets, terminal syntax, or developer-style labels in primary navigation.

## Desktop navigation

Canonical destinations:

### Cockpit

### Argent

- Dépenses
- Patrimoine
- Investissements
- Objectifs

### IA

- Advisor
- Chat
- Mémoire

### Radar

### Ops

Admin mode only.

- Orchestration
- Coûts
- Intégrations
- Santé

The shell also includes the appropriate:

- Search or Command entry
- Demo or Admin state
- User menu

Do not invent additional primary navigation without an explicit product decision.

## Mobile navigation

Canonical primary destinations:

- Cockpit
- Dépenses
- Patrimoine
- Advisor
- More

Secondary destinations and Admin functionality belong in More or appropriate contextual navigation.

Mobile is not compressed desktop.

Every page must have an intentional mobile hierarchy.

## Geometry

Finance-OS uses restrained geometry.

Prefer:

- low radii
- thin borders
- controlled surface separation
- precise spacing
- strong alignment

Avoid:

- pill-heavy interfaces
- oversized rounded cards
- generic bento grids
- glassmorphism
- decorative card walls

Cards are valid only when the content is genuinely object-based, such as providers, social sources, or other entities.

## Surfaces and tokens

Implementation should use the shared design tokens and canonical UI primitives.

Do not create isolated:

- colors
- radii
- spacing values
- shadows
- motion values
- page-specific visual systems

Existing tokens in `packages/ui/src/styles/globals.css` must be audited against the canonical handoff before migration.

Legacy token names may remain temporarily for compatibility, but they must not define the new visual direction.

Canonical surface hierarchy should express:

- application canvas
- primary working surfaces
- grouped controls and secondary planes
- floating overlays and focused controls

Separation should come from:

- depth
- whitespace
- thin rules
- typography
- contrast

Not from excessive card framing.

## Financial semantics

Financial meaning must never be encoded by brand color alone.

Use semantic treatment consistently:

### Positive

Gains, positive returns, healthy positive financial states.

### Negative

Losses, genuine negative financial states.

### Attention

Warnings, stale information, partial coverage, intervention required.

### Neutral

Normal values, informational states, unresolved context without false severity.

Never rely on color alone.

Always preserve a textual or structural equivalent.

## Financial data honesty

This is a non-negotiable product rule.

Unknown is not zero.

Unavailable is not zero.

Missing P&L is not zero percent.

Missing valuation is not zero euros.

Estimated data must remain identifiable as estimated.

Stale data must remain identifiable when freshness matters.

Partial or unresolved data must not be silently converted into precise-looking financial values.

The UI must preserve the canonical valuation states where relevant:

- priced
- derived
- estimated
- manual
- stale
- unresolved
- unavailable

Use human-facing wording where appropriate rather than exposing backend enums directly.

## Amounts and financial typography

Comparable amounts must align visually.

Use tabular numeric behavior where appropriate.

Lead with the most important amount, then provide context.

Do not exaggerate precision.

Do not show decimals when the product decision does not require them.

Financial amounts, percentages, and related numeric metadata should use the canonical Geist numeric treatment defined in the design handoff.

## Components

Before creating a new component, check whether the canonical design system or existing implementation already contains an equivalent.

The implementation should converge toward reusable families for:

### Shell

- AppShell
- TopNavbar
- NavDropdown
- NavDropdownItem
- NavIconTile
- MobileBottomNav
- MobileMoreDrawer
- CommandPalette
- UserMenu

### Controls

- Button
- IconButton
- Input
- Search
- Select
- SegmentedControl
- Tooltip
- Popover
- Drawer
- Modal

### Finance

- Amount
- CurrencyAmount
- PercentChange
- TrendIndicator
- BreakdownList
- MiniSparkline
- Progress

### Status

- Status
- ProviderStatus
- Freshness
- ValuationState

### Data

- TransactionsTable
- PositionsTable
- RunsTable
- CostsTable

### Product surfaces

- Surface
- Panel
- ProviderCard
- GoalSurface
- RecommendationRow
- OperationRow
- SignalRow
- SourceCard

Reuse product logic and shared visual grammar.

Do not create visually equivalent components under new names without a reason.

Existing legacy components such as `KpiTile`, `Panel`, `PageHeader`, `RangePill`, `BrandMark`, and `StatusDot` must be audited during migration.

They are not automatically canonical simply because they already exist.

Preserve them when they fit the new system.

Refactor or replace them when they do not.

## Page width system

Pages should use a small set of canonical layout behaviors.

### Standard

Normal financial and product pages.

### Wide

Dense financial or Ops surfaces.

### Focused

Reading and conversation experiences such as Chat.

### Immersive

Signature spatial experiences such as Mémoire and selected Radar states.

### Signature

Login and other intentionally art-directed entry experiences.

Do not create arbitrary page widths for each route.

## Tables

Tables should share one visual grammar.

Standardize:

- header hierarchy
- row height
- separators
- numeric alignment
- hover
- selected state
- action placement
- mobile transformation

Avoid generic enterprise table styling.

Do not hide important financial information behind excessive interaction.

## Charts

Charts should use a consistent Finance-OS grammar.

Standardize:

- axes
- grid treatment
- labels
- tooltips
- highlights
- empty states
- semantic colors

Use a small number of meaningful visualizations.

Do not create decorative charts to fill space.

Do not rely only on color to communicate meaning.

## Motion

Motion exists to communicate:

- causality
- continuity
- focus
- state change

Most Finance-OS interactions should be:

- fast
- subtle
- functional

Prefer opacity and transform where possible.

Avoid:

- scroll-jacking
- cursor trails
- constant ambient animation
- large staggered lists
- motion that delays access to financial information

`prefers-reduced-motion` must preserve the same information hierarchy.

Richer motion is allowed only where it serves a signature experience.

Primary signature areas include:

- Login
- Mémoire
- Radar

Command Pixel micro-motion may also appear in:

- loading states
- active operation states
- selected memory interactions
- small transitions

## Accessibility

Maintain:

- semantic structure
- visible focus
- complete keyboard flow
- strong contrast
- readable numeric hierarchy
- touch targets around 44 px where appropriate
- zoom support
- safe areas
- reduced motion support
- accessible dialogs and drawers
- chart alternatives
- non-color status communication

Accessibility is part of the design system, not a later cleanup task.

## Responsive behavior

Support:

- large desktop
- normal desktop
- tablet
- mobile

Mobile must use intentional information prioritization.

Do not simply stack every desktop surface vertically.

Tables, charts, navigation, overlays, forms, and data density should adapt deliberately.

## Advisor

Advisor is action-first.

Its primary job is to answer:

- when
- how much
- where
- what
- risk
- action

The primary experience is the monthly investment plan.

Flash is reserved for rare opportunities outside the normal investment cycle.

Investment preferences belong in the Advisor investment profile, not in a resurrected global Settings page.

The risk model uses understandable allocation buckets such as:

- Socle
- Croissance
- Opportuniste

Do not reintroduce long AI explanations.

Do not expose AI internals.

## Chat

Chat is intentionally minimal.

The primary experience is:

- conversation
- structured financial responses
- composer

Do not surround Chat with a dashboard.

Do not expose:

- model selection
- prompts
- context internals
- GraphRAG
- retrieval metadata
- technical AI controls

## Mémoire

Mémoire is a signature immersive experience.

The graph may use richer depth, motion, and spatial interaction.

It must remain human-readable.

Never expose:

- raw JSON
- GraphRAG
- Neo4j
- Qdrant
- embeddings
- raw node identifiers
- raw edge identifiers
- technical confidence values

The user explores memory, not database infrastructure.

## Radar

Radar observes.

Advisor recommends.

Radar should surface:

- important markets
- signals
- events
- freshness

It must not become:

- a news feed
- Bloomberg
- TradingView
- a trading terminal

Its signature visualization may be visually ambitious while remaining useful.

## Social Intelligence

Social Intelligence is a premium source library.

It may show:

- avatar
- name
- handle
- short bio
- source
- tags
- light status

Do not show:

- costs
- sync logs
- technical IDs
- backend errors
- operational diagnostics
- social feed clutter

## Ops

Ops is visible only in Admin mode.

### Orchestration

One job equals one clear interaction.

First-level information:

- name
- state
- last run
- duration
- primary action

Technical detail belongs in drilldown.

### Coûts

Show measurable operational costs across appropriate categories.

Support:

- day
- week
- month
- breakdown
- real
- estimated
- fixed
- anomalies

Keep the experience calm.

### Intégrations

The purpose is to understand which connections work.

Powens may support user-facing connect, reconnect, sync, and disconnect flows.

IBKR and Binance are configured only through the server environment.

Never create UI for:

- Binance API keys
- Binance API secrets
- IBKR Flex tokens
- IBKR Query IDs
- credentials editing
- secret reveal
- secret entry

### Santé

The purpose is to understand in seconds whether Finance-OS is working.

First level should prioritize:

- global health
- provider health
- freshness
- Asset Valuation coverage
- unresolved assets
- actionable problems

Do not recreate:

- Env Diagnostics
- logs
- CPU or RAM monitoring
- service topology
- raw infrastructure dashboards

## Login

PixelBlast is removed.

React Bits is removed.

Do not replace PixelBlast with another particle background or generic visual effect.

Login is a signature Finance-OS experience.

Its visual impact should come from:

- composition
- typography
- lighting
- depth
- refined motion
- interaction quality

It should feel cinematic and premium without becoming excessive.

## React Bits

React Bits is no longer part of the canonical Finance-OS design system.

Do not add new React Bits components.

Remove remaining React Bits dependencies and implementations during the appropriate cleanup phase when safe.

## Anti-patterns

Avoid:

- generic rounded KPI card walls
- glassmorphism
- purple AI identity
- giant hero text inside financial pages
- full terminal interfaces
- hacker aesthetics
- cyberpunk
- Y2K styling
- retro cosplay
- bracket language in normal UI
- decorative pixel body text
- hardcoded financial semantic colors
- fake financial precision
- generic bento layouts
- new UI libraries duplicating the current system
- AI narration
- decorative technical prose
- page-specific design systems
- unnecessary explanatory copy

## Implementation rule

The canonical design is frozen.

Do not reinterpret it during implementation.

The goal of the engineering phase is to reproduce and systematize the approved design while preserving existing business behavior.

Do not rewrite business logic merely because the UI is being refactored.

When implementation conflicts with an existing mockup because of a real product or technical constraint:

1. preserve financial correctness
2. preserve existing working business logic
3. preserve accessibility
4. preserve the canonical design intent
5. document the deviation

## Required implementation process

Do not start a full visual refactor blindly.

The implementation process is:

1. audit the current frontend without modifying it
2. compare the implementation with Command Pixel V1
3. migrate foundations
4. migrate the shell
5. consolidate shared components
6. migrate product pages
7. implement responsive and light states
8. remove legacy visual debt
9. run accessibility and visual QA
10. debug
11. run lint, typecheck, tests, and build

The detailed phase plan lives in:

`.design/command-pixel-v1/IMPLEMENTATION_PHASES.md`

## Source of truth

When design references disagree, use this priority order:

1. `.design/command-pixel-v1/`
2. this `DESIGN.md`
3. current approved implementation
4. older screenshots and historical design material

Archived explorations are not implementation targets.
