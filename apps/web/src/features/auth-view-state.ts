import type { AuthMode } from './auth-types'

export type AuthViewState = 'pending' | 'demo' | 'admin'

export const resolveAuthViewState = ({
  mode,
  isPending,
}: {
  mode?: AuthMode
  isPending: boolean
}): AuthViewState => {
  if (mode === 'admin') {
    return 'admin'
  }

  if (mode === 'demo') {
    return 'demo'
  }

  return isPending ? 'pending' : 'demo'
}
