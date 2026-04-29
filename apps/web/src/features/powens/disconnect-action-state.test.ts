import { describe, expect, it } from 'vitest'
import { getPowensDisconnectActionState } from './disconnect-action-state'

describe('getPowensDisconnectActionState', () => {
  it('requires a confirmation step before disconnect can run', () => {
    expect(
      getPowensDisconnectActionState({
        isAdmin: true,
        isConfirming: false,
        isPending: false,
      })
    ).toEqual({
      canStart: true,
      canCancel: true,
      canConfirm: false,
      showConfirmation: false,
    })

    expect(
      getPowensDisconnectActionState({
        isAdmin: true,
        isConfirming: true,
        isPending: false,
      })
    ).toMatchObject({
      canConfirm: true,
      showConfirmation: true,
    })
  })

  it('blocks demo and pending disconnect actions', () => {
    expect(
      getPowensDisconnectActionState({
        isAdmin: false,
        isConfirming: true,
        isPending: false,
      })
    ).toMatchObject({
      canStart: false,
      canConfirm: false,
    })

    expect(
      getPowensDisconnectActionState({
        isAdmin: true,
        isConfirming: true,
        isPending: true,
      })
    ).toEqual({
      canStart: false,
      canCancel: false,
      canConfirm: false,
      showConfirmation: true,
    })
  })
})
