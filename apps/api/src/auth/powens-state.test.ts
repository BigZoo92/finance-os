import { describe, expect, it } from 'bun:test'
import { createPowensCallbackState, readPowensCallbackState } from './powens-state'

const SECRET = 'test-secret-with-at-least-thirty-two-bytes!!'

describe('powens signed state', () => {
  it('creates and validates a signed callback state', () => {
    const nowSeconds = 1_700_000_000
    const state = createPowensCallbackState({
      secret: SECRET,
      nowSeconds,
    })

    const parsed = readPowensCallbackState({
      value: state,
      secret: SECRET,
      nowSeconds,
    })

    expect(parsed).toEqual({
      admin: true,
      exp: nowSeconds + 600,
    })
  })

  it('rejects expired state', () => {
    const nowSeconds = 1_700_000_000
    const state = createPowensCallbackState({
      secret: SECRET,
      nowSeconds,
    })

    const parsed = readPowensCallbackState({
      value: state,
      secret: SECRET,
      nowSeconds: nowSeconds + 700,
    })

    expect(parsed).toBeNull()
  })

  it('rejects tampered state', () => {
    const nowSeconds = 1_700_000_000
    const state = createPowensCallbackState({
      secret: SECRET,
      nowSeconds,
    })
    const tampered = `${state}tampered`

    const parsed = readPowensCallbackState({
      value: tampered,
      secret: SECRET,
      nowSeconds,
    })

    expect(parsed).toBeNull()
  })
})
