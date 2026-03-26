import type { FinancialGoalAction } from './types'

const readOnlineState = () => {
  if (typeof navigator === 'undefined') {
    return true
  }

  return typeof navigator.onLine === 'boolean' ? navigator.onLine : true
}

export const createGoalActionRequestId = (action: FinancialGoalAction) => {
  const randomPart =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

  return `goal-${action}-${randomPart}`
}

export const logGoalActionEvent = ({
  phase,
  action,
  requestId,
  goalId,
  status,
  code,
}: {
  phase: 'start' | 'success' | 'error'
  action: FinancialGoalAction
  requestId: string
  goalId?: number
  status?: number | 'network_error'
  code?: string
}) => {
  const payload = {
    phase,
    action,
    requestId,
    goalId: goalId ?? null,
    status: status ?? null,
    code: code ?? null,
    online: readOnlineState(),
    timestamp: new Date().toISOString(),
  }

  if (phase === 'error') {
    console.error('[web:goal-action]', payload)
    return
  }

  console.info('[web:goal-action]', payload)
}
