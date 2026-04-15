export const chatGroundedAnswerSchemaName = 'finance_os_grounded_chat_answer'

export const chatGroundedAnswerJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['answer', 'citations', 'assumptions', 'caveats', 'simulations'],
  properties: {
    answer: {
      type: 'string',
      minLength: 24,
      maxLength: 1800,
    },
    citations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['sourceType', 'sourceId', 'label'],
        properties: {
          sourceType: {
            type: 'string',
            enum: ['recommendation', 'brief', 'snapshot', 'signal', 'assumption'],
          },
          sourceId: {
            type: 'string',
            minLength: 1,
            maxLength: 120,
          },
          label: {
            type: 'string',
            minLength: 4,
            maxLength: 180,
          },
        },
      },
      maxItems: 10,
    },
    assumptions: {
      type: 'array',
      items: {
        type: 'string',
        minLength: 6,
        maxLength: 220,
      },
      maxItems: 6,
    },
    caveats: {
      type: 'array',
      items: {
        type: 'string',
        minLength: 6,
        maxLength: 220,
      },
      maxItems: 6,
    },
    simulations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'value'],
        properties: {
          label: {
            type: 'string',
            minLength: 4,
            maxLength: 120,
          },
          value: {
            type: 'string',
            minLength: 1,
            maxLength: 160,
          },
        },
      },
      maxItems: 8,
    },
  },
} as const
