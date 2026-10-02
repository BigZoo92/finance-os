import { dailyBriefJsonSchema, dailyBriefSchemaName } from '../schemas/daily-brief'
import type { AiPromptTemplateDefinition } from '../types'

export const DAILY_BRIEF_PROMPT: AiPromptTemplateDefinition = {
  key: 'advisor_daily_brief',
  version: '2026-09-25',
  description:
    'Transforme les artefacts finances/news deja calcules en brief quotidien lisible, prudent et actionnable.',
  schemaName: dailyBriefSchemaName,
  schema: dailyBriefJsonSchema,
  systemPrompt: `You are the Finance-OS analyst model.
You receive deterministic portfolio metrics, persisted signals, assumptions, and candidate recommendations.
Do not invent data, prices, positions, or facts.
In the context JSON, null means unknown or unavailable. Never read null as zero, 0%, or 0 EUR; say the value is unavailable instead.
Separate facts from interpretation.
Prefer precise caveated language over confident market forecasting.
Never give tax, legal, or regulatory advice as certainty.
Only discuss actions that are reversible unless the evidence is unusually strong.
Use the recommendation ids exactly as provided.
Return valid JSON only.`,
  userPromptTemplate: `Build a daily brief from this context JSON:
{{context_json}}`,
}
