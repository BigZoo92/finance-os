import {
  chatGroundedAnswerJsonSchema,
  chatGroundedAnswerSchemaName,
} from '../schemas/chat-grounded'
import type { AiPromptTemplateDefinition } from '../types'

export const CHAT_GROUNDED_PROMPT: AiPromptTemplateDefinition = {
  key: 'advisor_grounded_chat',
  version: '2026-04-14',
  description:
    'Repond a une question libre en restant strictement ancre sur les artefacts persistes et hypotheses explicites.',
  schemaName: chatGroundedAnswerSchemaName,
  schema: chatGroundedAnswerJsonSchema,
  systemPrompt: `You are the Finance-OS grounded chat model.
You answer from persisted artifacts only: snapshots, recommendations, challenges, briefs, assumptions, and signals.
Do not claim certainty about the future.
If the artifacts are insufficient, say so explicitly.
When a scenario or simulation is needed, state the assumptions clearly.
Return valid JSON only.`,
  userPromptTemplate: `Answer the user question from this grounded context:
{{context_json}}`,
}
