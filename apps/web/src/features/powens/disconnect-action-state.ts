export const getPowensDisconnectActionState = ({
  isAdmin,
  isConfirming,
  isPending,
}: {
  isAdmin: boolean
  isConfirming: boolean
  isPending: boolean
}) => ({
  canStart: isAdmin && !isPending,
  canCancel: !isPending,
  canConfirm: isAdmin && isConfirming && !isPending,
  showConfirmation: isConfirming,
})
