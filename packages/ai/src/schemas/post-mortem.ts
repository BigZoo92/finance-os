// LLM-output JSON schema for the advisor post-mortem.
//
// The schema is deliberately compact and strict: every field is required and `additionalProperties`
// is `false`. The LLM must match it exactly. Free-form chain-of-thought is not part of the
// shape — only structured findings, calibration, and learning actions are persisted.

export const postMortemSchemaName = 'finance_os_advisor_post_mortem'
export const postMortemSchemaVersion = '2026-05-04'

export const postMortemJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'version',
    'summary',
    'overallOutcome',
    'confidenceCalibration',
    'evidenceReview',
    'outcomeDrivers',
    'lessons',
    'learningActions',
    'safety',
  ],
  properties: {
    version: {
      type: 'string',
      const: postMortemSchemaVersion,
    },
    summary: {
      type: 'string',
      minLength: 16,
      maxLength: 800,
    },
    overallOutcome: {
      type: 'string',
      enum: ['positive', 'negative', 'neutral', 'mixed', 'inconclusive'],
    },
    confidenceCalibration: {
      type: 'object',
      additionalProperties: false,
      required: ['previousConfidence', 'calibratedConfidence', 'rationale'],
      properties: {
        previousConfidence: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'unknown'],
        },
        calibratedConfidence: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
        },
        rationale: { type: 'string', minLength: 4, maxLength: 480 },
      },
    },
    evidenceReview: {
      type: 'object',
      additionalProperties: false,
      required: [
        'supportedSignals',
        'contradictedSignals',
        'missingEvidence',
        'staleOrWeakEvidence',
      ],
      properties: {
        supportedSignals: {
          type: 'array',
          items: { type: 'string', minLength: 4, maxLength: 240 },
          maxItems: 16,
        },
        contradictedSignals: {
          type: 'array',
          items: { type: 'string', minLength: 4, maxLength: 240 },
          maxItems: 16,
        },
        missingEvidence: {
          type: 'array',
          items: { type: 'string', minLength: 4, maxLength: 240 },
          maxItems: 16,
        },
        staleOrWeakEvidence: {
          type: 'array',
          items: { type: 'string', minLength: 4, maxLength: 240 },
          maxItems: 16,
        },
      },
    },
    outcomeDrivers: {
      type: 'object',
      additionalProperties: false,
      required: ['likelyDrivers', 'alternativeExplanations', 'unknowns'],
      properties: {
        likelyDrivers: {
          type: 'array',
          items: { type: 'string', minLength: 4, maxLength: 240 },
          maxItems: 12,
        },
        alternativeExplanations: {
          type: 'array',
          items: { type: 'string', minLength: 4, maxLength: 240 },
          maxItems: 12,
        },
        unknowns: {
          type: 'array',
          items: { type: 'string', minLength: 4, maxLength: 240 },
          maxItems: 12,
        },
      },
    },
    lessons: {
      type: 'object',
      additionalProperties: false,
      required: ['keep', 'change', 'avoid'],
      properties: {
        keep: {
          type: 'array',
          items: { type: 'string', minLength: 4, maxLength: 240 },
          maxItems: 8,
        },
        change: {
          type: 'array',
          items: { type: 'string', minLength: 4, maxLength: 240 },
          maxItems: 8,
        },
        avoid: {
          type: 'array',
          items: { type: 'string', minLength: 4, maxLength: 240 },
          maxItems: 8,
        },
      },
    },
    learningActions: {
      type: 'array',
      maxItems: 16,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'title', 'description', 'scope', 'confidence', 'appliesTo'],
        properties: {
          kind: {
            type: 'string',
            enum: [
              'assumption',
              'caveat',
              'risk_calibration',
              'evidence_gap',
              'strategy_quality',
            ],
          },
          title: { type: 'string', minLength: 4, maxLength: 160 },
          description: { type: 'string', minLength: 8, maxLength: 480 },
          scope: { type: 'string', const: 'advisory-only' },
          confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
          appliesTo: {
            type: 'array',
            items: { type: 'string', minLength: 1, maxLength: 120 },
            maxItems: 8,
          },
        },
      },
    },
    safety: {
      type: 'object',
      additionalProperties: false,
      required: ['containsExecutionDirective', 'executionTerms'],
      properties: {
        containsExecutionDirective: { type: 'boolean' },
        executionTerms: {
          type: 'array',
          items: { type: 'string', minLength: 1, maxLength: 80 },
          maxItems: 16,
        },
      },
    },
  },
} as const

// TypeScript shape mirroring the schema above. Used by the use-case to type the structured
// runner result and the persisted findings/calibration jsonb columns.
export interface PostMortemLearningAction {
  kind: 'assumption' | 'caveat' | 'risk_calibration' | 'evidence_gap' | 'strategy_quality'
  title: string
  description: string
  scope: 'advisory-only'
  confidence: 'low' | 'medium' | 'high'
  appliesTo: string[]
}

export interface PostMortemOutput {
  version: typeof postMortemSchemaVersion
  summary: string
  overallOutcome: 'positive' | 'negative' | 'neutral' | 'mixed' | 'inconclusive'
  confidenceCalibration: {
    previousConfidence: 'low' | 'medium' | 'high' | 'unknown'
    calibratedConfidence: 'low' | 'medium' | 'high'
    rationale: string
  }
  evidenceReview: {
    supportedSignals: string[]
    contradictedSignals: string[]
    missingEvidence: string[]
    staleOrWeakEvidence: string[]
  }
  outcomeDrivers: {
    likelyDrivers: string[]
    alternativeExplanations: string[]
    unknowns: string[]
  }
  lessons: {
    keep: string[]
    change: string[]
    avoid: string[]
  }
  learningActions: PostMortemLearningAction[]
  safety: {
    containsExecutionDirective: boolean
    executionTerms: string[]
  }
}
