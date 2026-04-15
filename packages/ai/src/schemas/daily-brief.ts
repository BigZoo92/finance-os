export const dailyBriefSchemaName = 'finance_os_daily_brief'

export const dailyBriefJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'title',
    'summary',
    'keyFacts',
    'opportunities',
    'risks',
    'watchItems',
    'recommendationNotes',
  ],
  properties: {
    title: {
      type: 'string',
      minLength: 8,
      maxLength: 160,
    },
    summary: {
      type: 'string',
      minLength: 32,
      maxLength: 1200,
    },
    keyFacts: {
      type: 'array',
      items: {
        type: 'string',
        minLength: 8,
        maxLength: 240,
      },
      minItems: 2,
      maxItems: 8,
    },
    opportunities: {
      type: 'array',
      items: {
        type: 'string',
        minLength: 8,
        maxLength: 240,
      },
      maxItems: 5,
    },
    risks: {
      type: 'array',
      items: {
        type: 'string',
        minLength: 8,
        maxLength: 240,
      },
      maxItems: 5,
    },
    watchItems: {
      type: 'array',
      items: {
        type: 'string',
        minLength: 8,
        maxLength: 240,
      },
      maxItems: 6,
    },
    recommendationNotes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'recommendationId',
          'whyNow',
          'narrative',
          'confidenceDelta',
          'impactSummary',
          'alternatives',
        ],
        properties: {
          recommendationId: {
            type: 'string',
            minLength: 1,
            maxLength: 120,
          },
          whyNow: {
            type: 'string',
            minLength: 8,
            maxLength: 280,
          },
          narrative: {
            type: 'string',
            minLength: 16,
            maxLength: 480,
          },
          confidenceDelta: {
            type: 'number',
            minimum: -0.4,
            maximum: 0.4,
          },
          impactSummary: {
            type: 'string',
            minLength: 8,
            maxLength: 240,
          },
          alternatives: {
            type: 'array',
            items: {
              type: 'string',
              minLength: 4,
              maxLength: 180,
            },
            maxItems: 4,
          },
        },
      },
      maxItems: 10,
    },
  },
} as const
