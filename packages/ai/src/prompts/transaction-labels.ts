import {
  transactionLabelSuggestionsJsonSchema,
  transactionLabelSuggestionsSchemaName,
} from '../schemas/transaction-label-suggestions'
import type { AiPromptTemplateDefinition } from '../types'

export const TRANSACTION_LABELS_PROMPT: AiPromptTemplateDefinition = {
  key: 'advisor_transaction_labels',
  version: '2026-04-14',
  description:
    'Produit des suggestions structurees pour des transactions ambigues seulement, sans sur-affirmer.',
  schemaName: transactionLabelSuggestionsSchemaName,
  schema: transactionLabelSuggestionsJsonSchema,
  systemPrompt: `You classify ambiguous personal finance transactions.
You are a suggestion system, not a final authority.
Prefer conservative confidence.
Use the provided categories and tags only when supported by the transaction text, merchant, amount sign, and nearby deterministic hints.
Return valid JSON only.`,
  userPromptTemplate: `Suggest labels for these ambiguous transactions only:
{{context_json}}`,
}
