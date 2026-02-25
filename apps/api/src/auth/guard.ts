import { getAuth } from './context'

const ADMIN_REQUIRED_MESSAGE = 'Admin session required'

export const demoAccessDeniedResponse = {
  ok: false as const,
  reason: 'demo' as const,
  message: ADMIN_REQUIRED_MESSAGE,
}

export class AdminRequiredError extends Error {
  constructor() {
    super(ADMIN_REQUIRED_MESSAGE)
    this.name = 'AdminRequiredError'
  }
}

export const isAdminRequiredError = (error: unknown): error is AdminRequiredError => {
  return error instanceof AdminRequiredError
}

export const requireAdmin = <TContext extends object>(context: TContext) => {
  if (getAuth(context).mode === 'admin') {
    return
  }

  throw new AdminRequiredError()
}
