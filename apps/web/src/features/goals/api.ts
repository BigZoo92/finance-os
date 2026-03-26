import { ApiRequestError, apiFetch, apiRequest } from '@/lib/api'
import { createGoalActionRequestId, logGoalActionEvent } from './action-logger'
import type {
  FinancialGoal,
  FinancialGoalAction,
  FinancialGoalActionError,
  FinancialGoalsResponse,
  FinancialGoalWriteInput,
} from './types'

const readOnlineState = () => {
  if (typeof navigator === 'undefined') {
    return true
  }

  return typeof navigator.onLine === 'boolean' ? navigator.onLine : true
}

export const normalizeFinancialGoalActionError = (
  value: unknown
): FinancialGoalActionError => {
  const offline = !readOnlineState()

  if (value instanceof ApiRequestError) {
    const retryable =
      value.status === 'network_error' ||
      value.status === 408 ||
      value.status === 409 ||
      value.status === 429 ||
      (typeof value.status === 'number' && value.status >= 500)

    return {
      message: value.message,
      ...(value.code ? { code: value.code } : {}),
      ...(value.requestId ? { requestId: value.requestId } : {}),
      retryable,
      offline: offline || value.status === 'network_error',
    }
  }

  if (value instanceof Error) {
    return {
      message: value.message,
      retryable: false,
      offline,
    }
  }

  return {
    message: String(value),
    retryable: false,
    offline,
  }
}

const performGoalAction = async ({
  action,
  path,
  init,
  goalId,
}: {
  action: FinancialGoalAction
  path: string
  init: RequestInit
  goalId?: number
}) => {
  const requestId = createGoalActionRequestId(action)
  const headers = new Headers(init.headers)

  headers.set('content-type', 'application/json')
  headers.set('x-request-id', requestId)

  logGoalActionEvent({
    phase: 'start',
    action,
    requestId,
    ...(goalId ? { goalId } : {}),
  })

  const result = await apiRequest<FinancialGoal>(path, {
    ...init,
    headers,
  })

  if (!result.ok) {
    logGoalActionEvent({
      phase: 'error',
      action,
      requestId: result.error.requestId ?? requestId,
      ...(goalId ? { goalId } : {}),
      status: result.error.status,
      ...(result.error.code ? { code: result.error.code } : {}),
    })

    throw result.error
  }

  const resolvedRequestId = result.response.headers.get('x-request-id') ?? requestId
  const resolvedGoalId = goalId ?? result.data.id

  logGoalActionEvent({
    phase: 'success',
    action,
    requestId: resolvedRequestId,
    ...(resolvedGoalId ? { goalId: resolvedGoalId } : {}),
    status: result.response.status,
  })

  return result.data
}

export const fetchFinancialGoals = async () => {
  return apiFetch<FinancialGoalsResponse>('/dashboard/goals')
}

export const createFinancialGoal = async (input: FinancialGoalWriteInput) => {
  return performGoalAction({
    action: 'create',
    path: '/dashboard/goals',
    init: {
      method: 'POST',
      body: JSON.stringify(input),
    },
  })
}

export const updateFinancialGoal = async ({
  goalId,
  input,
}: {
  goalId: number
  input: FinancialGoalWriteInput
}) => {
  return performGoalAction({
    action: 'update',
    path: `/dashboard/goals/${goalId}`,
    goalId,
    init: {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  })
}

export const archiveFinancialGoal = async (goalId: number) => {
  return performGoalAction({
    action: 'archive',
    path: `/dashboard/goals/${goalId}/archive`,
    goalId,
    init: {
      method: 'POST',
    },
  })
}
