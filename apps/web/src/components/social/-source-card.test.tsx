// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { toSourceCard } from '@/features/social/view-model'
import { SourceCard } from './source-card'

afterEach(cleanup)

const card = toSourceCard({
  id: 2,
  provider: 'x_twitter',
  handle: '@unusual_whales',
  displayName: 'Unusual Whales',
  url: 'https://x.com/unusual_whales',
  group: 'finance',
  enabled: true,
  priority: 80,
  tags: ['options', 'flow', 'alerts', 'volatility'],
  language: 'en',
  includePatterns: [],
  excludePatterns: [],
  minRelevanceScore: 0,
  requiresAttentionPolicy: 'auto',
  lastFetchedAt: null,
  lastCursor: null,
  lastError: null,
  lastFetchedCount: null,
  verificationStatus: 'verified',
  profileMetadata: {
    username: 'unusual_whales',
    name: 'Unusual Whales',
    description: 'Options flow and market structure.',
    publicMetrics: {
      followersCount: 2_000_000,
      followingCount: 5,
      tweetCount: 90_000,
      listedCount: 40,
    },
  },
  createdAt: '2026-04-20T10:00:00Z',
  updatedAt: '2026-04-20T10:00:00Z',
})

describe('SourceCard', () => {
  it('leads with identity, tags and a light status, without metrics or raw enums', () => {
    const onSelect = vi.fn()
    render(<SourceCard source={card} selected={false} variant="card" onSelect={onSelect} />)

    const button = screen.getByRole('button')
    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByText('Unusual Whales')).toBeTruthy()
    expect(screen.getByText('@unusual_whales')).toBeTruthy()
    expect(screen.getByText('Options flow and market structure.')).toBeTruthy()
    expect(screen.getByText('Actif')).toBeTruthy()
    expect(screen.getByText('options')).toBeTruthy()
    expect(screen.getByText('+1')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'X' })).toBeTruthy()
    expect(document.body.textContent).not.toMatch(
      /followers|tweets|listed|x_twitter|verified|2 000 000/i
    )

    fireEvent.click(button)
    expect(onSelect).toHaveBeenCalledWith(2, button)
  })

  it('keeps the status readable without color in the mobile row', () => {
    render(
      <SourceCard
        source={{ ...card, enabled: false, status: 'paused' }}
        selected
        variant="row"
        onSelect={vi.fn()}
      />
    )

    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('En pause')).toBeTruthy()
    expect(screen.getByText('options')).toBeTruthy()
    expect(screen.queryByText('flow')).toBeNull()
  })
})
