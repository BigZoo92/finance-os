import { getAuth } from './context'
import type { AuthState } from './types'

export const isDemo = (auth: Pick<AuthState, 'mode'>) => auth.mode !== 'admin'

export const demoOrReal = async <TContext extends object, TDemoResult, TRealResult>({
  context,
  demo,
  real,
  isDemoMode,
}: {
  context: TContext
  demo: () => TDemoResult | Promise<TDemoResult>
  real: () => TRealResult | Promise<TRealResult>
  isDemoMode?: (context: TContext) => boolean
}): Promise<TDemoResult | TRealResult> => {
  const demoMode = isDemoMode ? isDemoMode(context) : isDemo(getAuth(context))
  if (demoMode) {
    return demo()
  }

  return real()
}
