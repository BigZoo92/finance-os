# Implementation Phases

Use this order for the frontend migration. Complete validation at each checkpoint before continuing.

## Phase 00: Audit

No visual changes.

Map:

- routes
- current AppShell
- current navigation
- page components
- styling layers
- design tokens
- duplicated primitives
- dead UI
- responsive behavior
- Light Mode behavior
- current tests

Produce a current to target mapping before editing.

## Phase 01: Foundations

Implement:

- Geist family usage
- Soft Orange Cream tokens
- spacing
- radius
- borders
- elevation
- motion
- responsive primitives
- copy rules where enforceable

Do not redesign pages yet.

## Phase 02: Shell

Implement:

- AppShell
- floating desktop navbar
- dropdowns
- command or search entry
- user menu
- Demo and Admin state
- mobile bottom navigation
- mobile Plus navigation

Validate shell across representative routes before continuing.

## Phase 03: Shared Components

Build reusable primitives before page migrations.

Focus on:

- surfaces
- buttons
- inputs
- amounts
- percentages
- status
- freshness
- progress
- tables
- charts container grammar
- drawers
- popovers
- modals
- tooltips

## Phase 04: Cockpit

Migrate the canonical Cockpit first and use it as the baseline for normal product pages.

## Phase 05: Argent

Migrate:

- Dépenses
- Patrimoine
- Investissements
- Objectifs

## Phase 06: IA

Migrate:

- Advisor
- Chat
- Mémoire 3D

Preserve the approved Advisor Action First architecture.

## Phase 07: Radar

Migrate:

- Radar
- Social Intelligence

## Phase 08: Ops

Admin only:

- Orchestration
- Coûts
- Intégrations
- Santé

## Phase 09: Login

Implement the signature Login without PixelBlast or ReactBits.

## Phase 10: Responsive, Light and States

Cross product validation for:

- mobile
- tablet
- Light Mode
- loading
- empty
- partial data
- stale
- error
- degraded
- focus
- keyboard
- reduced motion

## Phase 11: Cleanup

Remove obsolete visual implementation after confirming migration coverage.

## Phase 12: Verification

Run repository appropriate checks including lint, typecheck, tests and production build.

## Phase 13: Visual QA

Compare every migrated route against the canonical Claude Design frames.

Prioritize:

- geometry
- hierarchy
- typography
- page width
- spacing
- responsive behavior
- states
- copy density

## Phase 14: Debug

Fix regressions without reopening the visual direction.
