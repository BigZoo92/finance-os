import { describe, expect, it } from 'vitest'
import {
  MEMORY_ORIGIN_COPY,
  toAdvisorMemoryNodeViewModel,
  toHumanAdvisorMemoryLink,
  toHumanAdvisorMemoryNode,
  toMemorySourceLabel,
} from './advisor-memory-view-model'

describe('toMemorySourceLabel', () => {
  it('translates known system sources into human labels', () => {
    expect(toMemorySourceLabel('finance-engine')).toBe('Finance-OS')
    expect(toMemorySourceLabel('macro-feed')).toBe('Données de marché')
    expect(toMemorySourceLabel('ECB')).toBe('Banque centrale européenne')
  })

  it('drops opaque or technical source values', () => {
    expect(toMemorySourceLabel('source_id:42')).toBeNull()
    expect(toMemorySourceLabel('provider_internal')).toBeNull()
    expect(toMemorySourceLabel('3f2504e0-4f89-41d3-9a0c-0305e82c3301')).toBeNull()
  })

  it('normalizes forbidden punctuation in human source labels', () => {
    expect(toMemorySourceLabel('Rapport banque — import · août; archivé')).toBe(
      'Rapport banque, import, août, archivé'
    )
  })
})

describe('memory presentation', () => {
  it('maps technical node kinds to human labels without exposing ids', () => {
    const result = toAdvisorMemoryNodeViewModel({
      id: 'tx:secret',
      label: 'Logement',
      kind: 'transaction_cluster',
      source: 'finance-engine',
    })

    expect(result).toEqual({
      label: 'Logement',
      typeLabel: 'Dépenses',
      summary: null,
      sourceLabel: 'Finance-OS',
      isExample: false,
    })
    expect(JSON.stringify(result)).not.toContain('tx:secret')
  })

  it('keeps Demo and mixed origins explicit', () => {
    expect(MEMORY_ORIGIN_COPY.demo.label).toBe('Démonstration')
    expect(MEMORY_ORIGIN_COPY.mixed.description).toContain('exemples')
  })

  it('humanizes opaque node labels and removes technical summaries', () => {
    expect(
      toHumanAdvisorMemoryNode({
        id: 'account:secret',
        label: 'account:secret',
        kind: 'financial_account',
        summary: 'schema_version request_id provider_internal',
      })
    ).toEqual({ id: 'account:secret', label: 'Compte financier', kind: 'financial_account' })
  })

  it('removes technical link prose while keeping topology internal', () => {
    expect(
      toHumanAdvisorMemoryLink({
        source: 'a',
        target: 'b',
        kind: 'related_to',
        summary: 'retrieval hit from qdrant',
      })
    ).toEqual({ source: 'a', target: 'b', kind: 'related_to' })
  })
})
