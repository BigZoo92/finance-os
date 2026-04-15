export const recommendationChallengeSchemaName = 'finance_os_recommendation_challenge'

export const recommendationChallengeJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'recommendationId',
    'status',
    'summary',
    'contradictions',
    'missingSignals',
    'confidenceAdjustment',
  ],
  properties: {
    recommendationId: {
      type: 'string',
      minLength: 1,
      maxLength: 120,
    },
    status: {
      type: 'string',
      enum: ['confirmed', 'softened', 'flagged', 'skipped'],
    },
    summary: {
      type: 'string',
      minLength: 16,
      maxLength: 480,
    },
    contradictions: {
      type: 'array',
      items: {
        type: 'string',
        minLength: 6,
        maxLength: 220,
      },
      maxItems: 6,
    },
    missingSignals: {
      type: 'array',
      items: {
        type: 'string',
        minLength: 6,
        maxLength: 220,
      },
      maxItems: 6,
    },
    confidenceAdjustment: {
      type: 'number',
      minimum: -0.5,
      maximum: 0.2,
    },
  },
} as const
