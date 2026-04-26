# Token Economics — Finance-OS Agentic Pipeline

> Date: 2026-04-26
> Related: [model-routing-and-token-economics.md](../adr/model-routing-and-token-economics.md)

## Two Separate Cost Domains

| Domain | Pipeline | Storage | Tracking |
|---|---|---|---|
| Financial AI Advisor | `packages/ai/` | PostgreSQL (`ai_cost_ledger`, `ai_model_usage`) | `estimateModelUsageCost()` |
| Agentic Development | `scripts/agent-context/` | JSON files + optional graph | `telemetry-record.mjs` |

These are **never mixed**. Agentic costs are tagged `domain: 'agentic'`.

## Telemetry Schema

Each agent task run produces a telemetry record:

```json
{
  "taskId": "batch-42-spec-3",
  "taskType": "implement",
  "timestamp": "2026-04-26T14:30:00Z",
  "model": "codex",
  "reasoningEffort": "medium",
  "contextPacks": ["core", "api-backend"],
  "skills": ["finance-os/core-invariants", "security-and-hardening"],
  "budgetTier": "medium",
  "estimatedInputTokens": 12000,
  "estimatedOutputTokens": 3000,
  "actualInputTokens": null,
  "actualOutputTokens": null,
  "estimatedCostUsd": 0.045,
  "actualCostUsd": null,
  "cacheHitEstimate": 0.65,
  "success": true,
  "ciResult": "pass",
  "retryCount": 0,
  "degradedReasons": [],
  "elapsedMs": 45000,
  "domain": "agentic"
}
```

## What Gets Tracked

| Field | Required | Source |
|---|---|---|
| taskId | yes | Issue number or manual ID |
| taskType | yes | implement, review, debug, refactor, test, docs, batch, spec, improve |
| model | yes | codex, claude, qwen, kimi, gemma, hermes |
| reasoningEffort | yes | low, medium, high, xhigh |
| contextPacks | yes | Selected context packs |
| skills | yes | Selected skills |
| budgetTier | yes | small, medium, large, xlarge, autonomous |
| estimatedInputTokens | yes | From context selection |
| estimatedCostUsd | yes | From pricing registry |
| success | yes | Did the task complete? |
| actualInputTokens | no | From provider response if available |
| cacheHitEstimate | no | Stable prefix / total ratio |

## Storage

Telemetry records are stored as JSONL in `data/agentic-telemetry/`:
```
data/agentic-telemetry/2026-04.jsonl
data/agentic-telemetry/2026-05.jsonl
```

This directory is gitignored (contains local dev metrics, not source code).

## Optional Graph Ingestion

If the knowledge graph is available, agentic observations can be ingested as:
- `AgentRun` nodes (one per task)
- `CostObservation` nodes (cost per run)
- `TokenUsageObservation` nodes (token counts per run)

All tagged with `domain: 'agentic'`, `source: 'dev-pipeline'`.

## Commands

```bash
# Record a telemetry entry
pnpm agent:telemetry:record -- --task-id=batch-42 --type=implement --model=codex \
  --tokens-in=12000 --tokens-out=3000 --cost=0.045 --success

# View recent telemetry
cat data/agentic-telemetry/2026-04.jsonl | tail -5 | jq .
```

## Cost Targets

| Task Type | Target Budget | Target Model |
|---|---|---|
| Simple bugfix | < $0.05 | Qwen |
| Feature implementation | < $1.00 | Codex |
| Architecture review | < $2.00 | Claude |
| Batch spec expansion | < $0.50 | Codex |
| Full autopilot cycle | < $5.00 | Mixed |
