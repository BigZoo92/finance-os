# Model Routing — Finance-OS Agentic Pipeline

> See ADR: [model-routing-and-token-economics.md](../adr/model-routing-and-token-economics.md)

## Quick Reference: Which Model for Which Task

| Task | Model | Budget | Why |
|---|---|---|---|
| Simple bugfix | Qwen3-Coder | micro | Bounded risk, fast |
| Write tests | Qwen3-Coder | low | Mechanical, bounded output |
| Mechanical refactor | Qwen3-Coder | low | Pattern-based, low creativity |
| Multi-file implementation | Codex/GPT-5.5 | medium | Needs repo-wide reasoning |
| Architecture review | Claude Opus | medium-high | Deep reasoning, challenger role |
| Security audit | Claude + finance-os/core-invariants | medium | Safety-critical |
| UX/design critique | Claude Sonnet | low-medium | Product thinking |
| Large doc synthesis | Kimi K2 | low | Long-context, cheap |
| Code exploration (1M context) | Kimi K2 | low | Long context window |
| Classification/triage | Gemma (local) | ~0 | Privacy, speed, free |
| Summarization | Gemma (local) | ~0 | Offline capable |
| PR patch (autopilot) | Codex | medium | Repo write access, structured output |
| Spec expansion (autopilot) | Codex | low-medium | Structured JSON output |

## Escalation Policy

```
1. Try cheap model (Qwen/GPT-5.4-mini)
2. If confidence < threshold OR task fails:
   → Escalate to Codex/Claude Sonnet
3. If high-risk OR architecture:
   → Use Claude Opus / GPT-5.5 directly
4. If context > 128K:
   → Use Kimi K2 or Claude with 1M context
5. If sensitive/private:
   → Use Gemma (local) only
6. If deterministic tool exists:
   → Skip model entirely (linting, type checking, search)
```

## Budget Tiers

| Tier | Max per task | Typical models |
|---|---|---|
| micro | $0.01 | Gemma, Qwen |
| low | $0.10 | Qwen, GPT-5.4-mini |
| medium | $1.00 | Codex, Claude Sonnet |
| high | $10.00 | Claude Opus, GPT-5.5 xhigh |

Daily cap: $50 (configurable via `AGENT_MAX_DAILY_USD`)

## Not in Scope

- AI Advisor model selection (handled by `packages/ai/src/orchestration/budget-policy.ts`)
- Trading execution (never)
- Real-time model switching mid-conversation (defer to platform)
