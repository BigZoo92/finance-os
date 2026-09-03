import { describe, expect, it } from 'vitest'
import {
  ADVISOR_CHAT_EMPTY_SUGGESTIONS,
  getAdvisorChatAuthor,
  toAdvisorChatMessageViewModel,
} from './advisor-chat-view-model'
import type { DashboardAdvisorChatMessageResponse } from './dashboard-types'

const buildMessage = (
  overrides: Partial<DashboardAdvisorChatMessageResponse> = {}
): DashboardAdvisorChatMessageResponse => ({
  id: 42,
  role: 'assistant',
  content: 'Réponse financière prudente.',
  citations: [],
  assumptions: [],
  caveats: [],
  simulations: [],
  provider: null,
  model: null,
  createdAt: '2026-08-12T08:30:00.000Z',
  ...overrides,
})

describe('toAdvisorChatMessageViewModel', () => {
  it('keeps human citation labels and omits technical identifiers and model metadata', () => {
    const result = toAdvisorChatMessageViewModel(
      buildMessage({
        citations: [
          {
            sourceType: 'snapshot',
            sourceId: 'neo4j-node-4488',
            label: 'Snapshot 2026-08-12',
          },
          {
            sourceType: 'recommendation',
            sourceId: 'recommendation-81',
            label: 'Plan mensuel prudent',
          },
        ],
        provider: 'openai',
        model: 'gpt-internal-model',
      })
    )

    expect(result.details?.citations).toEqual([
      { label: 'Données au 2026-08-12' },
      { label: 'Plan mensuel prudent' },
    ])
    expect(Object.keys(result.details?.citations?.[0] ?? {})).toEqual(['label'])

    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain('sourceType')
    expect(serialized).not.toContain('sourceId')
    expect(serialized).not.toContain('snapshot')
    expect(serialized).not.toContain('neo4j-node-4488')
    expect(serialized).not.toContain('recommendation-81')
    expect(serialized).not.toContain('openai')
    expect(serialized).not.toContain('gpt-internal-model')
    expect(serialized).not.toContain('provider')
    expect(serialized).not.toContain('model')
  })

  it('drops malformed and technical structured records', () => {
    const result = toAdvisorChatMessageViewModel(
      buildMessage({
        citations: [
          { label: '' },
          { label: 14 },
          { label: 'Qdrant collection 12' },
          null,
          'not-an-object',
        ] as unknown as Array<Record<string, unknown>>,
        assumptions: ['', '   ', 'retrieval_mode: hybrid', 12] as unknown as string[],
        caveats: ['model: gpt', null] as unknown as string[],
        simulations: [
          { label: '', value: '100 €' },
          { label: 'Projection', value: 12 },
          { label: 'BM25 score', value: '0.92' },
          null,
        ] as unknown as Array<Record<string, unknown>>,
      })
    )

    expect(result).not.toHaveProperty('details')
  })

  it('treats malformed top-level structured fields as absent', () => {
    const result = toAdvisorChatMessageViewModel(
      buildMessage({
        citations: null,
        assumptions: { value: 'Horizon de dix ans' },
        caveats: 'Le rendement futur reste incertain.',
        simulations: { label: 'Projection', value: '100 €' },
      } as unknown as Partial<DashboardAdvisorChatMessageResponse>)
    )

    expect(result).not.toHaveProperty('details')
  })

  it('drops opaque identifiers even when they arrive in a display label', () => {
    const result = toAdvisorChatMessageViewModel(
      buildMessage({
        citations: [
          { label: '8ef4b258-0f3a-4bee-90a7-24c79fe55578' },
          { label: 'artifact-938242' },
        ],
      })
    )

    expect(result).not.toHaveProperty('details')
  })

  it('omits empty sections and keeps assumptions and caveats only when useful', () => {
    const empty = toAdvisorChatMessageViewModel(buildMessage())
    expect(empty).not.toHaveProperty('details')

    const populated = toAdvisorChatMessageViewModel(
      buildMessage({
        assumptions: ['  Horizon de dix ans  ', 'Horizon de dix ans'],
        caveats: ['Le rendement futur reste incertain.', '  '],
      })
    )

    expect(populated.details?.assumptions).toEqual(['Horizon de dix ans'])
    expect(populated.details?.caveats).toEqual(['Le rendement futur reste incertain.'])
    expect(populated.details).not.toHaveProperty('citations')
    expect(populated.details).not.toHaveProperty('simulations')
  })

  it('keeps simulation values as strings and marks the group hypothetical and non-authoritative', () => {
    const result = toAdvisorChatMessageViewModel(
      buildMessage({
        simulations: [
          { label: 'Capital projeté à dix ans', value: '1 234,56 €' },
          { label: 'Rendement réel indicatif', value: '3,20 %' },
        ],
      })
    )

    expect(result.details?.simulations).toEqual({
      items: [
        { label: 'Capital projeté à dix ans', value: '1 234,56 €' },
        { label: 'Rendement réel indicatif', value: '3,20 %' },
      ],
      state: 'estimated',
      stateLabel: 'Estimation',
      description: 'Résultats indicatifs fondés sur des hypothèses.',
      isHypothetical: true,
      isAuthoritative: false,
    })
    expect(Object.keys(result.details?.simulations?.items[0] ?? {})).toEqual(['label', 'value'])
    expect(result.details?.simulations?.items[0]?.value).toBe('1 234,56 €')
    expect(result.details?.simulations).not.toHaveProperty('amount')
    expect(result.details?.simulations).not.toHaveProperty('currency')
  })

  it('maps raw roles to readable authors without exposing system state', () => {
    expect(getAdvisorChatAuthor('user')).toEqual({ kind: 'user', label: 'Vous' })
    expect(getAdvisorChatAuthor('assistant')).toEqual({
      kind: 'finance-os',
      label: 'Finance-OS',
    })
    expect(getAdvisorChatAuthor('system')).toEqual({ kind: 'notice', label: 'Information' })
  })

  it('removes technical answer lines and forbidden punctuation from visible content', () => {
    const result = toAdvisorChatMessageViewModel(
      buildMessage({
        content:
          'Votre marge reste positive — à confirmer.\nmodel: hidden-provider\nContinuez avec prudence; gardez une réserve.',
      })
    )

    expect(result.content).toBe(
      'Votre marge reste positive, à confirmer.\nContinuez avec prudence, gardez une réserve.'
    )
    expect(result.content).not.toMatch(/model|provider|[·—;]/i)
  })

  it('normalizes structured punctuation and drops raw reliability percentages', () => {
    const result = toAdvisorChatMessageViewModel(
      buildMessage({
        content: 'Réponse utile.\nConfiance 87 %',
        citations: [{ label: 'Budget — août' }],
        assumptions: ['Revenus stables; hors prime'],
        caveats: ['Dépense variable · à confirmer'],
        simulations: [
          { label: 'Marge — estimée', value: '320 €; hypothétique' },
          { label: 'Confiance 91 %', value: 'à masquer' },
        ],
      })
    )

    expect(result.content).toBe('Réponse utile.')
    expect(result.details?.citations).toEqual([{ label: 'Budget, août' }])
    expect(result.details?.assumptions).toEqual(['Revenus stables, hors prime'])
    expect(result.details?.caveats).toEqual(['Dépense variable, à confirmer'])
    expect(result.details?.simulations?.items).toEqual([
      { label: 'Marge, estimée', value: '320 €, hypothétique' },
    ])
    expect(JSON.stringify(result)).not.toMatch(/[·—;]/)
  })
})

describe('ADVISOR_CHAT_EMPTY_SUGGESTIONS', () => {
  it('contains concise French prompts without forbidden punctuation', () => {
    expect(ADVISOR_CHAT_EMPTY_SUGGESTIONS).toHaveLength(4)
    expect(ADVISOR_CHAT_EMPTY_SUGGESTIONS.join(' ')).not.toMatch(/[·—;]/)
    expect(ADVISOR_CHAT_EMPTY_SUGGESTIONS.every(value => value === value.trim())).toBe(true)
  })
})
