<!-- GENERATED — DO NOT EDIT
     Source: .agentic/source/skills/ui-change-quality/SKILL.md
     Hash:   sha256:16afbfc38710ecca
     Sync:   pnpm agent:skills:sync -->

---
name: ui-change-quality
description: Review Finance-OS UI changes for loader-first data flow, state coverage, hierarchy, and review readiness. Use when dashboard, auth, Powens callback, or shared UI changes need rationale, screenshot notes, and state-quality checks.
---

# UI Change Quality

## Trigger

- Use when changing dashboard layouts, auth flows, callback pages, or shared UI primitives.
- Use when a UI change needs a sharper rationale than "it looks better" and should be checked for state coverage.

## Inputs

- Changed UI files
- User-facing behavior change
- Query or loader path involved

## Output

- Produce a UI review note with:
- rationale in one short paragraph
- loading, empty, error, and success state coverage
- accessibility or hierarchy concerns
- screenshot notes for the PR

## Workflow

1. Read [../../../apps/web/AGENTS.md](../../../apps/web/AGENTS.md) and [../../../docs/agentic/ui-quality-map.md](../../../docs/agentic/ui-quality-map.md).
2. Verify the change still respects loader-first data flow and SSR auth consistency.
3. Check that shared primitives in [../../../packages/ui/AGENTS.md](../../../packages/ui/AGENTS.md) remain generic and accessible.
4. Validate full UI state coverage against [../../../docs/agentic/policy-verification-bundle.md](../../../docs/agentic/policy-verification-bundle.md) (loading, empty, success, degraded, recoverable error, and gated states).
5. Capture the shortest useful rationale and screenshot checklist for review.

## Trigger Examples

- "Review this dashboard refresh and tell me whether it covers all required states and what screenshots to include."
- "Check whether this shared button/card change is still generic and safe for the Finance-OS cockpit."

## Verification

- Use [../../../docs/agentic/testing-map.md](../../../docs/agentic/testing-map.md) for the minimal automated checks.
- Use [../../../docs/agentic/code_review.md](../../../docs/agentic/code_review.md) for the review-ready output shape.
