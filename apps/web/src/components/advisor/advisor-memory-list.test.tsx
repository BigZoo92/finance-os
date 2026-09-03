// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AdvisorGraphNode } from '@/features/advisor-graph-data'
import { AdvisorMemoryList } from './advisor-memory-list'

afterEach(cleanup)

const nodes: AdvisorGraphNode[] = [
  {
    id: 'goal:internal-42',
    label: 'Apport immobilier',
    kind: 'goal',
    summary: 'Objectif de moyen terme.',
    freshness: 'fresh',
    confidence: 0.91,
    source: 'provider-secret',
  },
  {
    id: 'tx:internal-88',
    label: 'Logement',
    kind: 'transaction_cluster',
    freshness: 'stale',
    confidence: 0.52,
  },
]

describe('AdvisorMemoryList', () => {
  it('offers a human-readable accessible alternative without raw identifiers', () => {
    render(<AdvisorMemoryList nodes={nodes} selectedNodeId={null} onSelectNode={vi.fn()} />)

    expect(screen.getByRole('list', { name: 'Souvenirs visibles' })).toBeTruthy()
    expect(screen.getByText('Apport immobilier')).toBeTruthy()
    expect(screen.getByText('Dépenses')).toBeTruthy()
    expect(screen.getByText('Fiabilité élevée')).toBeTruthy()
    expect(screen.getByText('À actualiser')).toBeTruthy()
    expect(screen.queryByText('goal:internal-42')).toBeNull()
    expect(screen.queryByText('provider-secret')).toBeNull()
  })

  it('selects a memory with a real button interaction', () => {
    const onSelectNode = vi.fn()
    render(
      <AdvisorMemoryList
        nodes={nodes}
        selectedNodeId="goal:internal-42"
        onSelectNode={onSelectNode}
      />
    )

    const selected = screen.getByRole('button', { name: /apport immobilier/i })
    expect(selected.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: /logement/i }))
    expect(onSelectNode).toHaveBeenCalledWith('tx:internal-88')
  })
})
