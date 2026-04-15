import {
  recommendationChallengeJsonSchema,
  recommendationChallengeSchemaName,
} from '../schemas/recommendation-challenge'
import type { AiPromptTemplateDefinition } from '../types'

export const RECOMMENDATION_CHALLENGE_PROMPT: AiPromptTemplateDefinition = {
  key: 'advisor_recommendation_challenge',
  version: '2026-04-14',
  description:
    'Force une contre-analyse prudente d une recommandation importante pour eviter surreaction et causalite faible.',
  schemaName: recommendationChallengeSchemaName,
  schema: recommendationChallengeJsonSchema,
  systemPrompt: `You are the Finance-OS challenger model.
Your job is to break weak reasoning, not to be agreeable.
Look for missing data, weak causal links, recency bias, hidden costs, concentration risk, and irreversibility.
If evidence is thin, soften the recommendation rather than escalating it.
Do not invent hidden facts.
Return valid JSON only.`,
  userPromptTemplate: `Challenge this recommendation against the provided snapshot, signals, and assumptions:
{{context_json}}`,
}
