// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DashboardAdvisorChatMessageResponse } from '@/features/dashboard-types'
import { AdvisorChatComposer } from './advisor-chat-composer'
import { AdvisorChatMessage } from './advisor-chat-message'

afterEach(cleanup)

const structuredMessage: DashboardAdvisorChatMessageResponse = {
  id: 42,
  role: 'assistant',
  content: 'Votre marge estimée reste positive ce mois-ci.',
  citations: [
    { label: 'Budget du mois', sourceId: 'source-secret-42' },
    { label: 'neo4j source_id: hidden' },
  ],
  assumptions: ['Dépenses récurrentes inchangées'],
  caveats: ['Une dépense ponctuelle peut modifier cette marge'],
  simulations: [{ label: 'Marge disponible', value: '320 €' }],
  provider: 'provider-secret',
  model: 'model-secret',
  createdAt: '2026-08-12T08:00:00.000Z',
}

describe('Advisor Chat message surface', () => {
  it('renders useful structured fields without technical metadata', () => {
    render(<AdvisorChatMessage message={structuredMessage} />)

    expect(screen.getByText(structuredMessage.content)).toBeTruthy()
    expect(screen.getByText('320 €')).toBeTruthy()
    expect(screen.getByText('Hypothétique')).toBeTruthy()
    expect(screen.getByText('Une dépense ponctuelle peut modifier cette marge')).toBeTruthy()
    expect(screen.getByText('Hypothèses')).toBeTruthy()
    expect(screen.queryByText('provider-secret')).toBeNull()
    expect(screen.queryByText('model-secret')).toBeNull()
    expect(screen.queryByText('source-secret-42')).toBeNull()
    expect(screen.queryByText(/neo4j/i)).toBeNull()
  })

  it('keeps human references behind expandable disclosure', () => {
    render(<AdvisorChatMessage message={structuredMessage} />)

    const summary = screen.getByText('Références mentionnées')
    const details = summary.closest('details')
    expect(details?.open).toBe(false)
    fireEvent.click(summary)
    expect(details?.open).toBe(true)
    expect(screen.getByText('Budget du mois')).toBeTruthy()
  })
})

describe('Advisor Chat composer', () => {
  it('gates both typing and sending in read-only mode', () => {
    const onSend = vi.fn()
    render(
      <AdvisorChatComposer
        value="Question"
        canSend={false}
        sending={false}
        notice={null}
        onChange={vi.fn()}
        onSend={onSend}
      />
    )

    expect(
      (screen.getByRole('textbox', { name: 'Écrire à Finance-OS' }) as HTMLTextAreaElement).disabled
    ).toBe(true)
    expect(
      (screen.getByRole('button', { name: 'Envoyer le message' }) as HTMLButtonElement).disabled
    ).toBe(true)
    expect(screen.getByText('Le chat est en lecture seule.')).toBeTruthy()
    expect(onSend).not.toHaveBeenCalled()
  })

  it('sends with Enter, preserves Shift Enter, and surfaces an uncertain send state', () => {
    const onSend = vi.fn()
    const onChange = vi.fn()
    render(
      <AdvisorChatComposer
        value="Question"
        canSend
        sending={false}
        notice={{ tone: 'warning', message: 'Envoi non confirmé.' }}
        onChange={onChange}
        onSend={onSend}
      />
    )

    const composer = screen.getByRole('textbox', { name: 'Écrire à Finance-OS' })
    fireEvent.change(composer, { target: { value: 'Question modifiée' } })
    expect(onChange).toHaveBeenCalledWith('Question modifiée')

    fireEvent.keyDown(composer, { key: 'Enter', shiftKey: true })
    expect(onSend).not.toHaveBeenCalled()
    fireEvent.keyDown(composer, { key: 'Enter' })
    expect(onSend).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Envoi non confirmé.')).toBeTruthy()
  })
})
