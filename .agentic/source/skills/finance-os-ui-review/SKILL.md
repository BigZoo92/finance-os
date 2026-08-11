---
name: finance-os-ui-review
description: Audit a Finance-OS UI change for Command Pixel fidelity, financial clarity, accessibility, responsiveness, performance, and complete states. Use after UI implementation or for screenshot-based visual QA.
---

# UI review

Review against `DESIGN.md`, the live implementation, and screenshots at representative desktop and mobile widths.

## Review order

1. Task flow: can the user find the primary value/action without decorative competition?
2. Financial legibility: hierarchy, `.font-financial`, tabular alignment, currency/sign semantics, and chart labels.
3. System fidelity: canonical components/tokens, surface depth, spacing rhythm, Geist lock, restrained pixel accents.
4. States: loading, empty, stale/degraded, error, offline, gated, disabled, and long/large data.
5. Accessibility: semantic structure, labels, keyboard order, visible focus, contrast, zoom, reduced motion, and touch targets.
6. Responsive behavior: 320px through wide desktop, safe areas, overflow, tables/charts, and navigation.
7. Performance: layout shift, oversized assets, unnecessary client work, animation cost, and query waterfalls.

## Evidence

For each finding give severity, viewport/state, file/line, observed impact, and smallest correction. Distinguish design defects from preference. Report P0/P1 blockers first and do not invent findings.

UI changes need screenshot notes. When browser tooling is available, verify interactions rather than inferring from static markup; use `finance-os-browser-qa` for the execution workflow.
