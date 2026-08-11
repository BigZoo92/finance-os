---
name: finance-os-advisor-knowledge
description: Evolve the AI Advisor and temporal knowledge layer without confusing model output with financial truth. Use for finance-engine inputs, LLM orchestration, GraphRAG, memory, provenance, evals, recommendations, or Advisor UI.
---

# Advisor and knowledge

Read `docs/advisor.md` and the nearest app/package guide.

## Authority model

1. Transactions, positions, provider snapshots, and versioned deterministic fixtures are source data.
2. `packages/finance-engine` produces deterministic calculations and remains the numeric decision source.
3. The internal temporal knowledge graph is derived memory: it enriches, explains, retrieves, and challenges; it never replaces source data.
4. LLM output is advisory narrative with explicit provenance, assumptions, confidence, recency, and limitations.
5. Nothing in this layer may execute a trade, rebalance, transfer, or provider mutation.

## Demo/admin

- Demo uses deterministic Advisor and graph fixtures only, with zero DB/provider/model/service calls.
- Admin may call internal knowledge and configured model providers behind valid auth/internal state.
- Missing graph/model/provider data degrades to deterministic output with clear status; the cockpit stays usable.

## Temporal and evidence rules

- Preserve observed-at, valid-from/to, supersession, contradiction history, source, and retrieval recency.
- Do not present correlation, generated text, or stale evidence as causal fact.
- Prompts receive the minimum redacted bundle; raw provider payloads and secrets never enter prompts or logs.
- Costs, model IDs, token usage, and eval outcomes remain auditable but are not runtime dependencies.

## Verification

Test deterministic replay, demo isolation, provider/graph/model outage, stale and contradictory evidence, citation/provenance rendering, safe prompt construction, cost capture, and execution-vocabulary rejection.
