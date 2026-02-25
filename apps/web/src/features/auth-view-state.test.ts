import { describe, expect, it } from 'vitest'
import { resolveAuthViewState } from './auth-view-state'

describe('resolveAuthViewState', () => {
  it('returns pending when mode is not resolved yet', () => {
    expect(
      resolveAuthViewState({
        mode: undefined,
        isPending: true,
      })
    ).toBe('pending')
  })

  it('returns admin when mode is admin', () => {
    expect(
      resolveAuthViewState({
        mode: 'admin',
        isPending: true,
      })
    ).toBe('admin')
  })

  it('returns demo when mode is demo', () => {
    expect(
      resolveAuthViewState({
        mode: 'demo',
        isPending: false,
      })
    ).toBe('demo')
  })

  it('falls back to demo when query is resolved but mode is missing', () => {
    expect(
      resolveAuthViewState({
        mode: undefined,
        isPending: false,
      })
    ).toBe('demo')
  })
})
