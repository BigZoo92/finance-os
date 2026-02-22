import type { PowensRouteRuntime } from './types'

export const getPowensRuntime = <TContext extends object>(
  context: TContext
): PowensRouteRuntime => {
  return (context as TContext & { powens: PowensRouteRuntime }).powens
}
