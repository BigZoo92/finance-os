# ADR: Model Routing and Token Economics

> Status: Accepted
> Date: 2026-04-26

## Context

Finance-OS uses multiple AI models across two distinct pipelines:
1. **AI Advisor** (financial) — uses OpenAI/Anthropic via `packages/ai/` with existing budget policy and cost ledger
2. **Agentic development pipeline** — uses Codex/Claude/Kimi/Qwen/Hermes/Gemma for code tasks

The AI Advisor already has `computeAiBudgetState()`, `estimateModelUsageCost()`, and `aiCostLedger` in PostgreSQL.
The agentic pipeline has no cost tracking or model routing.

## Decision

### Model Roles

| Model | Primary Role | Cost Tier | Context | Best For |
|---|---|---|---|---|
| **Codex / GPT-5.5** | Implementation | $$$ | 128K-1M | Multi-file refactors, CI patches, debugging, implementation-heavy |
| **Claude Opus/Sonnet** | Architecture + Review | $$-$$$ | 200K-1M | Challenger/reviewer, security review, UX, docs quality, long reasoning |
| **Kimi K2** | Long-context discovery | $ | 1M+ | Large doc synthesis, agent swarm experiments, cheap exploration |
| **Qwen3-Coder** | Cheap coding | $ | 128K | Tests, mechanical refactors, simple bugfixes, bounded code generation |
| **Hermes** | Experimental | $ | Varies | Persistent agent memory experiments, self-improving loops |
| **Gemma (local)** | Offline triage | ~0 | 8K-32K | Classification, summarization, fail-soft tasks |

### Routing Dimensions

| Dimension | Values | Routing Impact |
|---|---|---|
| task_type | implement, review, debug, refactor, test, docs, triage | Primary selector |
| risk_level | low, medium, high, critical | High/critical -> frontier models only |
| context_size | small (<8K), medium (<32K), large (<128K), xlarge (>128K) | Large -> Kimi or high-context model |
| creativity | low, medium, high | High -> Claude/Codex |
| code_execution | none, sandbox, repo_write | repo_write -> Codex only (via autopilot) |
| cost_budget | micro (<$0.01), low (<$0.10), medium (<$1.00), high (<$10.00) | Constrains model choice |
| latency_tolerance | realtime (<5s), fast (<30s), batch (<5min), async (unlimited) | Realtime -> smaller models |
| privacy_level | public, internal, sensitive | Sensitive -> local/Gemma only |
| research_needed | none, web_search, doc_analysis | web_search -> models with browsing |
| strict_format | none, json, diff, structured | strict -> models with structured output |

### Budget Policies

1. **Default**: Qwen or GPT-5.4-mini for simple tasks
2. **Escalation**: If cheap model fails or returns low-confidence, escalate to Codex/Claude
3. **Challenger**: Claude as challenger only for high-risk changes (>$0.50 threshold)
4. **xhigh reasoning**: Opus/GPT-5.5 only for architecture, deep debugging, complex refactors
5. **Never frontier for**: grep/search, doc formatting, label assignment, simple classification
6. **Skip model if**: deterministic script/tool can do the job (linting, type checking, test running)

### Environment Configuration

```env
# Model routing (agentic pipeline, NOT AI Advisor)
AGENT_MODEL_ROUTER_ENABLED=true
AGENT_DEFAULT_MODEL=qwen3-coder
AGENT_CHEAP_CODE_MODEL=qwen3-coder
AGENT_REVIEW_MODEL=claude-sonnet-4-6
AGENT_LONG_CONTEXT_MODEL=kimi-k2
AGENT_LOCAL_MODEL=gemma-3
AGENT_MAX_DAILY_USD=50
AGENT_MAX_TASK_USD=5
AGENT_CONTEXT_BUDGET_SMALL=8000
AGENT_CONTEXT_BUDGET_MEDIUM=16000
AGENT_CONTEXT_BUDGET_LARGE=32000
AGENT_CONTEXT_BUDGET_XLARGE=64000
```

No provider secrets in frontend env. These config vars are for CI/scripts/internal use only.

### Pricing Registry Extension

The existing `packages/ai/src/pricing/registry.ts` should be extended with agentic model entries:

| Model | Input $/M | Cached $/M | Output $/M | Context | Source |
|---|---|---|---|---|---|
| GPT-5.2 | $1.75 | $0.175 | $14.00 | 1M | openai.com |
| GPT-5 Mini | $0.25 | $0.025 | $2.00 | — | openai.com |
| GPT-5 Nano | $0.05 | $0.005 | $0.40 | — | openai.com |
| Claude Sonnet 4.6 | $3.00 | $0.30 read | $15.00 | 1M | anthropic.com |
| Claude Opus 4.6 | $5.00 | $0.50 read | $25.00 | 1M | anthropic.com |
| Claude Haiku 4.5 | $1.00 | $0.10 read | $5.00 | 200K | anthropic.com |
| Kimi K2.6 | $0.74 | — | $4.66 | 262K | openrouter.ai |
| Kimi K2.5 | $0.60 | — | $2.50 | 256K | openrouter.ai |
| Qwen3-Coder | free (self-hosted) | — | free | 256K | qwen.ai |
| Gemma (local) | free | — | free | 8-32K | local |

Key findings from research:
- OpenAI cached input = 10% of standard price (90% discount, automatic)
- Anthropic cache read = 10% of standard price; cache write = 125-200% depending on TTL tier
- Kimi K2.6 supports 200-300 sequential tool calls without drift at $0.74/$4.66 per M
- Qwen3-Coder 480B/35B active matches Claude Sonnet 4 on SWE-Bench at zero cost if self-hosted
- Intelligent model routing achieves 85% cost reduction while maintaining 95% of GPT-4 quality (UC Berkeley/Canva study)

### Cost Separation

| Pipeline | Tracking | Storage |
|---|---|---|
| AI Advisor (financial) | `estimateModelUsageCost()` | `aiModelUsage` + `aiCostLedger` tables |
| Agentic development | `scripts/agent-context/telemetry-record.mjs` | JSON files + optional graph ingestion |

The agentic pipeline does NOT share the AI Advisor's PostgreSQL cost ledger.
If graph ingestion is enabled, agentic observations use `domain: 'agentic'` tag.

## Alternatives Considered

| Approach | Decision |
|---|---|
| Single model for everything | Rejected — wastes money on simple tasks |
| Full LLM gateway (LiteLLM, etc.) | Deferred — adds infra complexity |
| Token-based routing only | Rejected — task type matters more than token count |
| No routing (user picks manually) | Rejected for autopilot, kept for manual Claude/Codex use |

## Consequences

- Simple tasks cost ~10x less via cheap model routing
- High-risk tasks get appropriate model attention
- Agentic costs become visible and controllable
- Model routing policy is declarative and auditable
- No new runtime dependencies — routing is config + scripts
