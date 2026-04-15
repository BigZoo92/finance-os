export const transactionLabelSuggestionsSchemaName = 'finance_os_transaction_label_suggestions'

export const transactionLabelSuggestionsJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['suggestions'],
  properties: {
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'transactionId',
          'suggestedKind',
          'suggestedCategory',
          'suggestedSubcategory',
          'suggestedTags',
          'confidence',
          'rationale',
        ],
        properties: {
          transactionId: {
            type: 'integer',
            minimum: 1,
          },
          suggestedKind: {
            type: 'string',
            enum: [
              'income',
              'expense',
              'transfer',
              'investment',
              'reimbursement',
              'fees',
              'taxes',
              'cash_movement',
            ],
          },
          suggestedCategory: {
            type: 'string',
            minLength: 2,
            maxLength: 64,
          },
          suggestedSubcategory: {
            anyOf: [
              {
                type: 'string',
                minLength: 2,
                maxLength: 64,
              },
              { type: 'null' },
            ],
          },
          suggestedTags: {
            type: 'array',
            items: {
              type: 'string',
              minLength: 2,
              maxLength: 32,
            },
            maxItems: 8,
          },
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 1,
          },
          rationale: {
            type: 'array',
            items: {
              type: 'string',
              minLength: 6,
              maxLength: 220,
            },
            minItems: 1,
            maxItems: 6,
          },
        },
      },
      maxItems: 24,
    },
  },
} as const
