# AI Advisor and temporal knowledge

The Advisor explains and challenges deterministic finance outputs. It is advisory-only and cannot trade, transfer, rebalance, or mutate provider accounts.

## Authority stack

1. Normalized transactions, positions, market/news/provider snapshots, and deterministic fixtures are input evidence.
2. `packages/finance-engine` produces deterministic calculations and remains the numeric source of truth.
3. The temporal knowledge service stores derived entities/relations, provenance, validity, recency, and contradictions.
4. `packages/ai` plus the API Advisor domain orchestrate model calls, costs, run status, evals, and safe output.
5. UI presents recommendations with assumptions, confidence, freshness, and evidence—not certainty.

## Demo and admin

Demo uses deterministic Advisor and graph fixtures only: no database, model, provider, knowledge-service, or quant-service call. Admin may call configured internal/provider services behind the admin session; explicitly guarded server-to-server orchestration routes may instead accept `PRIVATE_ACCESS_TOKEN`. Knowledge and quant services remain isolated on the internal network and do not implement signed-token authentication.

If a model, graph, market source, or internal service fails, deterministic calculations remain available and the response reports degraded evidence. Never fabricate citations or silently substitute model values for missing finance-engine output.

## Temporal knowledge contract

The graph is internal derived memory, not a transaction source. Records retain source, observed time, valid-from/to, supersession, confidence, retrieval recency, and contradiction history. Retrieval results must be traceable back to evidence and may challenge an old conclusion.

Knowledge and prompts use the minimum redacted bundle. Raw provider payloads, credentials, session values, and unnecessary personal detail never enter prompts or logs.

## Advisor workflow

The dashboard domain under `apps/api/src/routes/dashboard/domain/advisor/` builds bundles, runs deterministic and optional model stages, records runs/costs, and exposes daily brief, decision journal, replay, post-mortem, learning, and manual refresh/orchestration surfaces. Provider/data-quality status narrows recommendations when evidence is stale or incomplete.

Manual orchestration is guarded and locked; it must not turn ordinary read routes into provider refresh triggers.

## Evals and learning

Evals are deterministic review gates for grounding, causal claims, strategy quality, risk calibration, and execution vocabulary. Run them with:

```text
pnpm evals:run
pnpm evals:run -- --strict
```

Learning-loop artifacts and fine-tuning readiness are evidence about quality, not permission to self-modify prompts or enable fine-tuning automatically. Human review and versioned prompt/eval changes remain required.

## Trading Lab

`apps/quant-service` and the Trading Lab route run research scenarios/backtests over declared datasets, assumptions, fees, spread, slippage, and walk-forward boundaries. Results are hypothetical analytics. They do not create signals for live execution and never receive brokerage mutation credentials.

## Verification

Cover deterministic replay, demo isolation, service outage, stale and contradictory evidence, provenance rendering, prompt redaction, cost capture, execution-language rejection, and data-quality gating. Knowledge-service local details remain in `apps/knowledge-service/README.md`; the quant-service contract remains in its code and tests.
