/**
 * SSR-safe hook for `prefers-reduced-motion: reduce`.
 *
 * Returns `false` on the server (and on the first render before mount)
 * so SSR and CSR markup stay aligned, then flips to the live media-query
 * value on the client and listens for changes.
 *
 * The conservative default (`false`) means the page renders the
 * standard motion experience server-side. Components should use the
 * returned value to decide between motion and reduced-motion variants
 * AFTER hydration, rather than forking SSR/CSR.
 */
import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

const readInitial = (): boolean => {
  if (typeof window === 'undefined') return false
  if (typeof window.matchMedia !== 'function') return false
  try {
    return window.matchMedia(QUERY).matches
  } catch {
    return false
  }
}

export const usePrefersReducedMotion = (): boolean => {
  const [reduced, setReduced] = useState<boolean>(false)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia(QUERY)
    const update = () => setReduced(mql.matches)
    update()
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', update)
      return () => mql.removeEventListener('change', update)
    }
    // Older Safari / legacy fallback.
    mql.addListener(update)
    return () => mql.removeListener(update)
  }, [])

  return reduced
}

/**
 * Pure helper for tests / non-hook callers. Reads the live value once
 * without subscribing. SSR-safe.
 */
export const readPrefersReducedMotion = readInitial
