/**
 * Measured content width of an element, kept in sync through ResizeObserver.
 * Returns 0 until the element is mounted and measured (SSR-safe).
 */
import { type RefObject, useEffect, useState } from 'react'

export const useElementWidth = (ref: RefObject<HTMLElement | null>): number => {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    setWidth(Math.round(element.getBoundingClientRect().width))
    if (typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(entries => {
      const entry = entries[0]
      if (entry) setWidth(Math.round(entry.contentRect.width))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])

  return width
}
