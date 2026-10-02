import { describe, expect, it } from 'bun:test'

// Provider HTTP clients are server-runtime concerns and live on
// `@finance-os/ai/providers`; the root barrel stays prompts/schemas/scoring only.
const PROVIDER_CLIENT_EXPORTS: readonly string[] = [
  'createAnthropicMessagesClient',
  'createOpenAiResponsesClient',
]

const ISOMORPHIC_EXPORTS: readonly string[] = [
  // evals
  'DEFAULT_AI_EVAL_CASES',
  'findExecutionDirectives',
  'isScoredCategory',
  'scoreCase',
  // knowledge-context
  'compactKnowledgeContextForPrompt',
  // orchestration
  'computeAiBudgetState',
  // pricing
  'estimateModelUsageCost',
  // prompts
  'CHAT_GROUNDED_PROMPT',
  'DAILY_BRIEF_PROMPT',
  'POST_MORTEM_PROMPT',
  'RECOMMENDATION_CHALLENGE_PROMPT',
  'TRANSACTION_LABELS_PROMPT',
  // run-status
  'isAiRunTerminalStatus',
  // schemas
  'chatGroundedAnswerJsonSchema',
  'dailyBriefJsonSchema',
  'postMortemJsonSchema',
  'recommendationChallengeJsonSchema',
  'transactionLabelSuggestionsJsonSchema',
]

describe('@finance-os/ai root barrel', () => {
  it('exports the isomorphic modules', async () => {
    const exported = Object.keys(await import('./index'))
    const missing = ISOMORPHIC_EXPORTS.filter(name => !exported.includes(name))

    expect(missing).toEqual([])
  })

  it('does not leak the provider clients', async () => {
    const exported = Object.keys(await import('./index'))
    const leaked = PROVIDER_CLIENT_EXPORTS.filter(name => exported.includes(name))

    expect(leaked).toEqual([])
  })
})

describe('@finance-os/ai/providers barrel', () => {
  it('exports the provider clients', async () => {
    const exported = Object.keys(await import('./providers/index'))
    const missing = PROVIDER_CLIENT_EXPORTS.filter(name => !exported.includes(name))

    expect(missing).toEqual([])
  })
})
