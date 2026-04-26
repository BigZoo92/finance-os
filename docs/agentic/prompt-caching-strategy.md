# Prompt Caching Strategy — Finance-OS

> Date: 2026-04-26
> Related ADR: [agent-efficiency-context-budget-model-router.md](../adr/agent-efficiency-context-budget-model-router.md)

## Goal

Maximize prompt cache hit rates across AI providers to reduce cost and latency for repeated agentic tasks.

## How Provider Caching Works

### OpenAI (automatic)
- Caches the **longest common prefix** automatically — no code changes needed
- Minimum: **1,024 tokens**; then works in **128-token increments**
- TTL: 5-60 minutes (server-managed, no user control)
- Cached input costs **10% of standard price** (90% discount)
- Example: GPT-5.2 standard $1.75/M, cached $0.175/M
- Latency reduction: up to 80% for long prompts (67% faster TTFT at 150K+ tokens)
- Tool definitions, structured output schemas, images, audio are all cacheable
- **Key rule**: Do not reorder or insert content at the start of the prompt

### Anthropic Claude (explicit + automatic)
- Supports explicit `cache_control` breakpoints — up to **4 breakpoints** per request
- Minimum cached block: **1,024 tokens** (Sonnet), **2,048-4,096** (Opus), **4,096** (Haiku)
- Two TTL tiers:
  - `"type": "ephemeral"` — **5-minute** TTL, write cost = 1.25x input price
  - `"type": "ephemeral", "ttl": "1h"` — **60-minute** TTL, write cost = 2.0x input price
- Cache reads: **10% of input price** (90% discount) regardless of TTL tier
- Break-even: 5-min cache pays off after 1 read; 1-hour after 2 reads
- Processing order: **Tools -> System -> Messages** (all contribute to cache prefix)
- Claude Code auto-caches system prompts, CLAUDE.md, and tool definitions
- Even a **single-character change** in a cached prefix invalidates the cache
- **Key rule**: Place stable content early, mark with cache_control breakpoints

## Prompt Structure Design

Every agentic prompt should follow this structure:

```
┌─────────────────────────────────┐
│ STABLE PREFIX (cached)          │  ← Changes rarely
│  1. System role instructions    │
│  2. Core context pack           │
│  3. Selected domain context     │
│  4. Selected skills (sorted)    │
├─────────────────────────────────┤
│ VOLATILE SUFFIX (not cached)    │  ← Changes per task
│  5. Task-specific payload       │
│  6. Code context (files, diffs) │
│  7. Output contract             │
│  8. Nonce/timestamp             │
└─────────────────────────────────┘
```

### Rules for Cache-Friendly Prefixes

1. **No timestamps in stable prefix** — timestamps bust cache on every call
2. **No random IDs in stable prefix** — use deterministic identifiers
3. **Fixed ordering** — always: system → core → domain → skills (alphabetical)
4. **Versioned content** — context packs use content hashes, not dates
5. **No inline code snippets in prefix** — put code in the volatile suffix
6. **Skills sorted alphabetically** — prevents reordering from busting cache
7. **Newlines normalized** — trailing whitespace and blank line count matters

### What Belongs in Stable Prefix

| Content | Estimated Tokens | Stability |
|---|---|---|
| System role instructions | 200-500 | Very stable |
| `docs/agentic/context-packs/core.md` | ~2,300 | Stable (changes with AGENTS.md) |
| Selected domain context pack | 200-3,400 | Stable per domain |
| Selected skill content | 1,000-5,000 | Stable (skills change rarely) |
| **Total stable prefix** | **~3,700-11,200** | Cached across many tasks |

### What Belongs in Volatile Suffix

| Content | Tokens | Changes |
|---|---|---|
| Task description / issue body | 100-2,000 | Every task |
| File contents / diffs | 500-50,000 | Every task |
| Output schema/contract | 100-500 | Per task type |
| Nonce / task ID | 10-50 | Every task |

## Context Pack Sizing

Each context pack is designed to fit within prompt caching minimums:

| Pack | Tokens | Cache-worthy? |
|---|---|---|
| core.md | ~2,300 | Yes (>1,024 for Anthropic) |
| web-ui.md | ~3,400 | Yes |
| api-backend.md | ~1,600 | Yes |
| worker-sync.md | ~600 | Combine with core |
| ai-advisor.md | ~900 | Combine with core |
| deploy-ci.md | ~1,300 | Yes |
| design-system.md | ~260 | Combine with web-ui |
| testing.md | ~170 | Combine with core |
| security.md | ~170 | Combine with core |
| autopilot.md | ~230 | Combine with core |

**Recommendation**: For Anthropic, combine small packs with core to reach 1,024-token cache minimum.

## Prompt Builder

Use `pnpm agent:prompt:build` to generate cache-optimized prompts:

```bash
# Build prompt for a web-ui task
node scripts/agent-context/prompt-builder.mjs \
  --domains=web-ui \
  --budget=medium \
  --task="Add loading state to dashboard widget"

# Output: structured prompt with stable prefix + volatile suffix
```

## Anti-Patterns (Cache Busters)

1. **Embedding `new Date()` in system prompt** — busts cache every second
2. **Randomizing skill order** — different prefix = cache miss
3. **Including full file contents in prefix** — too volatile
4. **Re-generating context pack text** — use cached static files
5. **Adding "as of today" date strings** — use version hashes instead
6. **Different indentation/whitespace** — exact byte match required

## Cacheability Score

The prompt builder estimates a cacheability score:

```
cacheability = stable_prefix_tokens / total_prompt_tokens
```

| Score | Rating | Action |
|---|---|---|
| > 0.5 | Good | Most of the prompt is cacheable |
| 0.3-0.5 | Fair | Consider moving more content to stable prefix |
| < 0.3 | Poor | Large task payload — cache savings limited |

## Measuring Cache Impact

- OpenAI: Check `usage.prompt_tokens_details.cached_tokens` in API response
- Anthropic: Check `usage.cache_read_input_tokens` and `usage.cache_creation_input_tokens`
- Both providers report cache hits in response metadata
- The telemetry schema tracks `cachedInputTokens` and `cacheWriteTokens`
