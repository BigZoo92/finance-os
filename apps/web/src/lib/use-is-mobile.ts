/**
 * SSR-safe `lg` breakpoint hook (below 1024px is the mobile/tablet shell).
 *
 * Returns `false` on the server and on the first client render so SSR and
 * hydration markup stay aligned, then follows the live media query.
 */
import { useEffect, useState } from 'react'

const QUERY = '(max-width: 1023px)'

export const useIsMobile = (): boolean => {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const media = window.matchMedia(QUERY)
    const update = () => setIsMobile(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return isMobile
}
