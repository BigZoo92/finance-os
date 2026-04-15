import { describe, expect, it } from 'bun:test'
import { chatGroundedAnswerJsonSchema } from './chat-grounded'
import { dailyBriefJsonSchema } from './daily-brief'
import { recommendationChallengeJsonSchema } from './recommendation-challenge'
import { transactionLabelSuggestionsJsonSchema } from './transaction-label-suggestions'

describe('AI JSON schemas', () => {
  it('keeps all top-level schemas strict and structured', () => {
    expect(dailyBriefJsonSchema.type).toBe('object')
    expect(dailyBriefJsonSchema.additionalProperties).toBe(false)
    expect(dailyBriefJsonSchema.required).toContain('recommendationNotes')

    expect(recommendationChallengeJsonSchema.type).toBe('object')
    expect(recommendationChallengeJsonSchema.additionalProperties).toBe(false)
    expect(recommendationChallengeJsonSchema.required).toContain('confidenceAdjustment')

    expect(chatGroundedAnswerJsonSchema.type).toBe('object')
    expect(chatGroundedAnswerJsonSchema.additionalProperties).toBe(false)
    expect(chatGroundedAnswerJsonSchema.required).toContain('citations')

    expect(transactionLabelSuggestionsJsonSchema.type).toBe('object')
    expect(transactionLabelSuggestionsJsonSchema.additionalProperties).toBe(false)
    expect(transactionLabelSuggestionsJsonSchema.required).toEqual(['suggestions'])
  })

  it('keeps nested recommendation and citation objects closed', () => {
    expect(dailyBriefJsonSchema.properties.recommendationNotes.items.type).toBe('object')
    expect(dailyBriefJsonSchema.properties.recommendationNotes.items.additionalProperties).toBe(
      false
    )
    expect(dailyBriefJsonSchema.properties.recommendationNotes.items.required).toContain(
      'confidenceDelta'
    )

    expect(chatGroundedAnswerJsonSchema.properties.citations.items.type).toBe('object')
    expect(chatGroundedAnswerJsonSchema.properties.citations.items.additionalProperties).toBe(
      false
    )
    expect(chatGroundedAnswerJsonSchema.properties.citations.items.required).toEqual([
      'sourceType',
      'sourceId',
      'label',
    ])
  })

  it('keeps model-facing enums bounded to the supported taxonomy', () => {
    expect(
      recommendationChallengeJsonSchema.properties.status.enum
    ).toEqual(['confirmed', 'softened', 'flagged', 'skipped'])

    expect(
      transactionLabelSuggestionsJsonSchema.properties.suggestions.items.properties.suggestedKind
        .enum
    ).toEqual([
      'income',
      'expense',
      'transfer',
      'investment',
      'reimbursement',
      'fees',
      'taxes',
      'cash_movement',
    ])
  })
})
