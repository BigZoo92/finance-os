# PRE_MAQUETTES_FULL_DIAGNOSTIC

Date: 2026-06-03

> **Follow-up (PRE-MAQUETTES-FOLLOWUP-VALIDATION-0):** the data-foundation gaps
> below (stale-run/recovery status, fixed-cost accounting, memory enrichment
> status, reusable categorization rules) have been addressed. See
> [`PRE_MAQUETTES_FOLLOWUP_VALIDATION_0.md`](PRE_MAQUETTES_FOLLOWUP_VALIDATION_0.md)
> for what changed, why the Ops card showed "en cours" then "échec", the new UI
> behaviour, and prod validation commands. Companion docs:
> [`ops/refresh-orchestrator.md`](../ops/refresh-orchestrator.md) (recovery
> taxonomy), [`ops/memory-lifecycle.md`](../ops/memory-lifecycle.md),
> [`ops/costs-model.md`](../ops/costs-model.md),
> [`ops/categorization-rules.md`](../ops/categorization-rules.md). Route/nav
> policy (§3/§10) and a11y/perf tooling (§8) remain open before
> `UI-A11Y-PERF-BASELINE-0`.

Scope: diagnostic pre-maquettes / pre-UI-refactor only. No UI refactor, route deletion,
destructive migration, production change, provider call, DB mutation, or secret-bearing
operation was performed.

## 1. Executive Summary

Verdict: not ready for final mockups yet. The product direction is clear enough to
prepare mockups, but four blocking decisions must be closed first: route policy, design
identity, cost accounting model, and where admin/ops surfaces live.

The codebase is healthier than the visible UI suggests. Advisor run status handling is
partly fixed, the knowledge/memory stack is implemented with demo-safe and fail-soft
paths, X/Twitter usage has a ledger, and transaction categorization has deterministic
rules plus admin-only overrides. The remaining risk is not lack of implementation; it is
fragmentation across visible routes, technical copy, legacy redirects, estimated-only
cost displays, and admin tools leaking into user navigation.

Top 10 findings:

1. `NAV_ITEMS` still exposes several expert/admin-like surfaces in the main shell:
   `/signaux`, `/signaux/marches`, `/signaux/social`, `/integrations`, `/sante`,
   `/parametres`, and `/ia/trading-lab` are not all admin-only.
2. Cleanup candidates are clear: `/transactions`, `/marches`, `/memoire`, and
   `/signaux/x-twitter` are duplicate or redirect-only routes.
3. Advisor status is partly normalized in the Advisor UI, but Ops refresh polling still
   uses raw queued/running state and can keep treating recovered runs as active.
4. Recovery can mark stale manual operations terminal while child steps stay `running`,
   leaving job cards or legacy panels with stale "en cours" badges.
5. X/Twitter cost display is sourced from `x_twitter_usage_ledger.estimated_cost_usd`;
   `actual_cost_usd` exists but is not used by the health snapshot.
6. Fixed subscription costs such as "2 x 8 EUR" are not represented in the current cost
   model or docs.
7. Memory/GraphRAG code paths are real, but the UI does not expose the Postgres
   enrichment ledger endpoint `/ops/knowledge/enrichment/status`.
8. Admin memory defaults can fall back to local storage, which can make the graph look
   available even when Neo4j/Qdrant are not the active production backends.
9. Categorization has per-transaction manual overrides, but no reusable user rule table
   or polished acceptance workflow for AI suggestions.
10. UI/a11y/perf automation is thin: Playwright exists, but there is no axe, Lighthouse,
    or bundle analyzer script in the inspected web package/config.

## 2. Post-Debug Validated State

Validated by static repository inspection:

- Demo/admin split is preserved in the inspected routes: provider, DB, and live
  knowledge paths remain behind mode/admin/internal-token checks where expected.
- The Advisor run status domain has terminal and degraded states in
  `packages/ai/src/run-status.ts`, with unit coverage.
- `resolveAdvisorManualOperationUiStatus` maps linked terminal Advisor runs for the
  Advisor page, reducing stale "running" display on that surface.
- Ops refresh has a recovery route, stale manual-operation recovery, and stale
  background-run recovery.
- X/Twitter Social has a usage ledger, budget guard, health endpoint, and admin-only
  mutation controls inside the page.
- Knowledge/memory demo mode returns deterministic fixtures, while admin mode calls an
  internal knowledge service and fails soft when unavailable.
- Transaction categorization is deterministic and testable, with static merchant,
  counterparty, MCC, manual override, and fallback precedence.
- The current documented visual identity is still Aurora Pink. A move to "Finance-OS
  Command Pixel" would require design-doc updates before UI implementation.

Not validated live:

- VPS container state, Neo4j node counts, Qdrant collection contents, production
  knowledge-service health, real X billing, real provider usage, or live admin cookies.
- Visual screenshots, keyboard walkthroughs, axe checks, Lighthouse traces, and bundle
  chunk measurements.

## 3. ROUTES-CLEANUP-0

Route and navigation policy should be decided before mockups. The current route graph is
usable but too broad for a personal finance cockpit.

| Route / Surface | Current State | Recommendation | Risk / Decision |
|---|---|---|---|
| `/transactions` | Root route outside `_app`, English copy, duplicates spending concepts. | Replace with redirect or absorb into `/depenses`. | Strong cleanup candidate. Preserve deep-link behavior if any external links exist. |
| `/marches` | Redirects to `/signaux/marches`. | Remove from nav and keep redirect only if needed. | Strong cleanup candidate. |
| `/memoire` | Redirects to `/ia/memoire`. | Remove from nav and keep redirect only if needed. | Strong cleanup candidate. |
| `/signaux/x-twitter` | Legacy redirect to `/signaux/social`. | Remove from nav/docs; keep redirect temporarily. | Strong cleanup candidate. Docs currently reference this shape. |
| `/fiscalite` | Real page with dashboard and external-investment summary. | Product decision: keep, absorb into Patrimoine, or hide until mature. | Do not delete blindly. |
| `/signaux` | Expert signal page with Advisor/knowledge/trading language. | Absorb into Ops or Advisor diagnostics; hide from default cockpit. | Current copy is technical and not daily-use ready. |
| `/signaux/marches` | Real markets/macros page with admin refresh. | Decide whether it is a user "Marches" view or Ops data-source view. | Current route lives under technical "signaux". |
| `/signaux/social` | Real X/Bluesky intelligence page; mutations gated by admin UI state. | Move under Ops/admin or make nav admin-only. | Variable cost and provider risk; should not be normal user nav by default. |
| `/signaux/sources` | Admin nav item; source diagnostics. | Absorb under Ops. | Page-level admin semantics should be explicit, not only nav-driven. |
| `/signaux/free-firehose` | Admin-only firehose estimate/run surface. | Absorb under Ops. | Live mutation/cost surface. |
| `/ops-env-diagnostics` | Admin-only diagnostics page. | Absorb under Ops. | Good diagnostic content, poor top-level route. |
| `/orchestration` | Admin-only refresh/recovery surface. | Keep as Ops section, not default route. | Needs status wording cleanup. |
| `/sante` | Health/status surface. | Decide if user health view or Ops diagnostics. | Current nav is not admin-only. |
| `/integrations` | Provider/integration surface. | Split user-visible connection state from admin diagnostics. | Current nav is not admin-only. |
| `/parametres` | Settings plus technical/export/recompute visuals. | Split personal settings from admin tools. | Contains ReactBits/hardcoded color leftovers. |
| `/ia/couts` | AI cost page, admin-only nav. | Keep under Ops/Costs or Advisor admin. | Needs combined cost model if X/Social costs are included. |
| `/ia/trading-lab` | Trading-lab route visible in nav. | Hide/admin-only or remove from personal cockpit navigation. | Finance-OS invariant forbids execution paths; avoid trading framing in main UX. |

Navigation findings:

- Desktop shell is still sidebar-first. A future top navigation can be mocked, but the
  implementation should first decide which pages survive in default user navigation.
- Mobile bottom tabs currently emphasize `/`, `/depenses`, `/patrimoine`, `/ia`, and
  "More". The requested cockpit labels should map explicitly to the surviving route set.
- `CommandPalette` is driven from `NAV_ITEMS`, so hidden/admin route decisions must be
  reflected there. Keyword coverage is incomplete for some admin routes.
- Route cleanup should update `docs/frontend/information-architecture.md`,
  `apps/web/src/components/shell/nav-items.ts`, command-palette copy, and any docs that
  still mention legacy paths.

## 4. UI/UX Leftovers Post-Debug

Leftovers that should be removed or resolved before high-fidelity mockups:

- "Prochaines actions" is repeated across several pages and reads as a generic backlog
  label instead of a personal finance cockpit action model.
- Technical labels remain visible: "IA Advisor", "GraphRAG", "Knowledge Graph",
  "context bundle", "orchestration", "free firehose", and "signals".
- Several admin-like pages are normal navigation items rather than clearly gated Ops
  surfaces.
- Some workflows still use browser `prompt` or `confirm`, notably transaction
  classification, social deletion, firehose runs, and goal archive confirmation.
- Advisor/Ops status copy can still conflate "recovery succeeded" with "stale run marked
  failed/timed out".
- Job-level run badges can show stale running state after operation-level recovery.
- The Social/X page mixes cost controls, provider health, source setup, audience search,
  and analyst output in one large view.
- Some components use hardcoded colors or legacy surface classes instead of canonical
  semantic/design tokens.
- ReactBits components are allowed by repo policy, but token customization is uneven and
  should be aligned before mockups rely on them.
- The current shell has a different information architecture from the desired future
  top-nav + simplified cockpit direction.

## 5. COSTS-0 X/Twitter/Social

Current source of truth:

- X/Twitter displayed variable cost comes from
  `GET /dashboard/signals/x-twitter/health`.
- That endpoint uses `readXUsageSnapshot`, which aggregates
  `x_twitter_usage_ledger.estimated_cost_usd`.
- The ledger has `actual_cost_usd`, but the health snapshot does not prefer it.
- The Social page displays daily/monthly estimated usage in USD only.
- AI Advisor costs are separate: `GET /dashboard/advisor/spend` reads
  `ai_cost_ledger`.

Gaps before mockups:

- No recurring/fixed subscription model was found. The requested "2 x 8 EUR" Social/X
  subscription cost is not represented.
- X/Social variable usage and AI model cost are separate ledgers and separate screens.
- X cost copy should explicitly say "estimated" unless actual billed amounts are wired.
- Currency handling is inconsistent: AI cost docs support an EUR conversion rate, while
  X/Social health is USD-only.
- AI monthly spend uses `createdAt` for the month window while daily rows use
  `ledgerDate`; this can diverge for backfilled or late-arriving entries.
- `docs/ops/x-twitter.md` references an older `/signaux/x-twitter` route shape.

Recommended cost-model decision:

- Keep variable usage ledgers separate from fixed subscription commitments.
- Add or design a fixed-cost source of truth before UI mockups, for example a
  `recurring_provider_cost` / `fixed_subscription_cost` table or deterministic fixture.
- Display a combined "Social intelligence cost" only after defining: currency, month
  boundary, actual-vs-estimated precedence, budget semantics, and owner/action labels.
- Prefer `actual_cost_usd` when present; otherwise fall back to `estimated_cost_usd` with
  explicit degraded/estimated copy.

## 6. MEMORY-0

Current implementation state:

- API routes under advisor knowledge support deterministic demo fixtures and admin-only
  knowledge-service calls.
- `KnowledgeServiceClient` propagates request IDs, uses safe failures, and avoids secret
  logging.
- Graph ingest is fail-soft and writes compact, sanitized events for decision points and
  learning actions.
- `advisor_memory_event` records graph write status plus nodes, edges, and vectors
  written.
- `/ops/knowledge/enrichment/status` exposes recent enrichment status, counts, and write
  outcomes.
- The knowledge service can use production Neo4j/Qdrant backends, but defaults allow
  local fallback unless strict production settings are enabled.

Unvalidated live:

- Whether the VPS knowledge-service container is up.
- Whether admin mode is using Neo4j/Qdrant or local fallback.
- Whether Neo4j contains expected finance knowledge nodes/edges.
- Whether Qdrant has the expected collection and vectors.
- Whether recent `advisor_memory_event` rows show successful graph writes.

UI readiness gaps:

- The user-facing memory page shows knowledge-service stats but not the Postgres
  enrichment ledger endpoint.
- The graph page can be technically correct while still unclear to a user because it
  exposes GraphRAG/knowledge terms.
- Rebuild controls live near user-facing memory surfaces; they should likely move into
  Ops/admin.
- Mockups need explicit states for: real production graph, local fallback, degraded
  service, empty graph, mixed demo examples, and stale enrichment.

Safe live-check commands for a VPS/operator, without printing secrets:

```bash
curl -sS -H "x-request-id: pre-mockup-memory-0" http://127.0.0.1:8011/health
curl -sS -H "x-request-id: pre-mockup-memory-0" http://127.0.0.1:8011/knowledge/stats
curl -sS -H "x-request-id: pre-mockup-memory-0" "$APP_URL/api/dashboard/advisor/knowledge/stats"
curl -sS -H "x-request-id: pre-mockup-memory-0" "$APP_URL/api/ops/knowledge/enrichment/status"
docker compose ps knowledge-service qdrant neo4j
docker compose logs --since=24h knowledge-service qdrant neo4j
```

For Neo4j/Qdrant counts, run shell commands with credentials from the server environment
only; do not echo tokens, passwords, cookies, or API keys into logs.

## 7. CATEGORIZATION-0

Current implementation state:

- Transactions have base provider category plus custom category, subcategory, income
  type, tags, merchant, and merchant history fields.
- The deterministic categorization engine has explicit precedence:
  `manual_override`, `merchant_rules`, `mcc`, `counterparty`, then `fallback`.
- Admin-only classification updates persist per-transaction custom fields.
- Backfill exists and defaults to dry run.
- Shadow/cutover logic tracks disagreements between provider category and deterministic
  categorization.
- AI relabel suggestions exist in `ai_transaction_label_suggestion`.

Gaps before mockups:

- There is no durable reusable user rule table.
- Manual correction UI uses browser prompts rather than a product-grade form.
- AI suggestions are not connected to a clear accept/reject/convert-to-rule workflow.
- Categorization disagreement observability is in-memory and not durable.
- The backfill route can mutate base `transaction.category` when `dryRun=false`; it needs
  audit, idempotency, and rollback decisions before operational use.
- The current categorization model is good enough for deterministic demo behavior, but
  not enough for a polished "teach the app once" UX.

Recommended future model:

- Add an additive `user_categorization_rule` concept rather than editing static code
  rules through the UI.
- Store matcher type, matcher value/pattern, priority, target category/subcategory/tags,
  income type, merchant override, source transaction, status, confidence, hit counts,
  last matched date, and audit metadata.
- Keep demo fixtures deterministic and admin mutations gated.
- Show a correction workflow that can either update one transaction or create a reusable
  rule with a preview of affected transactions.

## 8. UI-A11Y-PERF-0

Current state:

- Playwright is configured and starts API/web in deterministic demo mode.
- Reduced-motion handling exists in several components and the 3D knowledge graph has a
  performance mode.
- Heavy libraries are present: Three.js, React Three Fiber/Drei, react-force-graph-3d,
  D3, GSAP, Motion, postprocessing, and lightweight-charts.
- Some heavy surfaces are route-level or dynamically loaded, but no bundle report was
  produced in this diagnostic.

Gaps:

- No `axe-core`, `@axe`, `pa11y`, Lighthouse, bundle visualizer, or size-limit tooling
  was found in the inspected configs.
- Playwright currently focuses on Chromium and demo mode; it does not prove admin-only
  Social, Ops, knowledge, or provider states.
- Several routes still need keyboard, focus, reduced-motion, and mobile overflow review.
- Hardcoded colors/radii and legacy surface classes remain in technical routes.
- Financial values should be checked for `.font-financial` usage and semantic positive /
  negative / warning tokens before visual refactor.

Minimum verification before mockup implementation:

- Desktop and mobile screenshots for Cockpit, Depenses, Patrimoine, Advisor, More/Ops,
  Social cost state, Memory degraded state, and transaction correction.
- Keyboard navigation through shell, command palette, dialogs, forms, and tabular lists.
- Reduced-motion screenshots for ReactBits and 3D/motion-heavy surfaces.
- Bundle/chunk report proving heavy graph/chart dependencies are not loaded into the
  default cockpit path.
- At least one automated accessibility pass, preferably axe on representative routes.

## 9. Design Readiness

Design readiness verdict: blocked until identity and information architecture are
decided.

Current canonical docs require Aurora Pink:

- `DESIGN.md`
- `docs/frontend/design-system.md`
- `docs/context/DESIGN-DIRECTION.md`
- root `AGENTS.md`

If the new direction is "Finance-OS Command Pixel", then the design source of truth must
be updated before UI work. Otherwise implementation agents are required to preserve
Aurora Pink and may reject mockups that intentionally move away from it.

Required inputs before mockups:

- Final route policy: keep, hide, absorb into Ops, redirect, or remove.
- Final navigation model: desktop top nav vs sidebar, mobile tab labels, More/Ops split.
- Final copy rules: personal finance terms vs technical AI/Ops terms.
- Final cost model: estimated vs actual, fixed subscriptions, currency, monthly
  boundaries, budget labels.
- Final memory state model: real Neo4j/Qdrant vs local fallback vs degraded vs empty.
- Final categorization UX: one-off correction vs reusable rule vs AI suggestion review.

## 10. Final Split Into Max 3 Implementation Prompts

### Prompt 1: ROUTES-NAV-COPY-0

Clean the information architecture before visual work. Decide and implement route policy
for duplicate redirects, admin/Ops surfaces, user-facing cockpit routes, mobile tabs,
desktop navigation, and command-palette copy. Update
`docs/frontend/information-architecture.md` and preserve demo/admin invariants. Do not
delete real routes without a redirect/deep-link policy.

Expected output: simplified route map, admin-only Ops grouping, updated nav/command
palette, route docs, focused tests or smoke coverage for navigation.

### Prompt 2: FOUNDATIONS-STATUS-COST-MEMORY-CATEGORIZATION-0

Fix the data foundations that would otherwise make mockups dishonest: normalize
Advisor/Ops stale-run display, distinguish recovery success from timed-out run outcome,
define fixed and variable Social/X cost accounting, expose memory enrichment status in
Ops, and design the reusable categorization-rule model without destructive backfill.

Expected output: small additive contracts, tests for status/cost/memory/categorization
edge cases, docs for source-of-truth and fallback behavior.

### Prompt 3: UI-SYSTEM-A11Y-PERF-MAQUETTES-0

After prompts 1 and 2, implement the visual mockup pass against the chosen design
identity. Update design docs first if moving from Aurora Pink to Command Pixel. Replace
browser prompts with designed dialogs, align ReactBits/token usage, verify mobile and
desktop screenshots, add accessibility checks, and produce bundle evidence for heavy
visual routes.

Expected output: mockup-ready UI branch, screenshot notes, accessibility/performance
evidence, and updated design-system documentation.

## Commands Run And Results

- `git status --short`: clean before this documentation change.
- `Get-Content` on the attached pasted request: confirmed diagnostic-only French scope.
- `Get-Content` on root/app/package/design/AGENTS docs: confirmed repo invariants,
  verification commands, and Aurora Pink design source of truth.
- `rg --files apps/web/src/routes`: inventoried route topology.
- Targeted `rg` / `Get-Content` across shell navigation, command palette, route tree,
  Advisor status, Ops refresh, X usage ledger, knowledge service, memory ingest,
  transaction categorization, and web package/config files.
- No production curl, DB query, provider call, migration, build, or test suite was run.
  This is intentional because the task requested a pre-implementation diagnostic and no
  behavior changed.

## Risks And Decisions Needed

- Design conflict: Aurora Pink is mandatory in current docs; Command Pixel needs a
  source-of-truth update before implementation.
- Route conflict: visible expert/Ops routes need a product decision before mockups.
- Cost conflict: estimated X usage cannot honestly represent actual billing or fixed
  subscriptions yet.
- Memory conflict: local fallback can mask missing Neo4j/Qdrant unless UI and Ops checks
  show backend provenance clearly.
- Categorization conflict: a polished correction UX needs reusable rules, not just
  one-transaction overrides.
- Status conflict: Advisor/Ops recovery semantics must be normalized before designing
  "run complete" or "sync recovered" states.
