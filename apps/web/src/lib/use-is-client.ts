import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}

/**
 * `false` during SSR and the hydration pass, `true` once the client has taken
 * over. React re-renders with the client snapshot right after hydration, so a
 * client-only widget (canvas charts) mounts without an effect that sets state.
 */
export const useIsClient = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  )
