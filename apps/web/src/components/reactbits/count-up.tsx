/**
 * CountUp — animated numeric reveal.
 *
 * Adapted from React Bits (MIT + Commons Clause).
 * Source: https://reactbits.dev/ts/tailwind/TextAnimations/CountUp
 *
 * Finance-OS changes:
 *  - French number formatting (`Intl.NumberFormat('fr-FR')`) by default
 *  - Respects `prefers-reduced-motion` — skips the tween entirely
 *  - Honors an explicit `format` override for custom renderers (€, %, etc.)
 */
import { useInView, useMotionValue, useReducedMotion, useSpring } from 'motion/react'
import { useCallback, useEffect, useRef } from 'react'

type CountUpProps = {
  to: number
  from?: number
  direction?: 'up' | 'down'
  delay?: number
  duration?: number
  className?: string
  startWhen?: boolean
  /** Custom string formatter, overrides the default locale format. */
  format?: (value: number) => string
  /** Locale for the default Intl formatter. */
  locale?: string
  /** Number of decimals to keep in default formatting (auto-detected from `from`/`to` when omitted). */
  decimals?: number
  onStart?: () => void
  onEnd?: () => void
}

export function CountUp({
  to,
  from = 0,
  direction = 'up',
  delay = 0,
  duration = 1.2,
  className,
  startWhen = true,
  format,
  locale = 'fr-FR',
  decimals,
  onStart,
  onEnd,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const prefersReducedMotion = useReducedMotion()
  const motionValue = useMotionValue(direction === 'down' ? to : from)

  const damping = 22 + 40 * (1 / duration)
  const stiffness = 100 * (1 / duration)

  const springValue = useSpring(motionValue, { damping, stiffness })
  const isInView = useInView(ref, { once: true, margin: '0px' })

  const autoDecimals = (() => {
    if (typeof decimals === 'number') return decimals
    const decimalsOf = (n: number) => {
      const s = n.toString()
      return s.includes('.') ? (s.split('.')[1]?.length ?? 0) : 0
    }
    return Math.max(decimalsOf(from), decimalsOf(to))
  })()

  const formatValue = useCallback(
    (latest: number) => {
      if (format) return format(latest)
      const options: Intl.NumberFormatOptions = {
        useGrouping: true,
        minimumFractionDigits: autoDecimals,
        maximumFractionDigits: autoDecimals,
      }
      return new Intl.NumberFormat(locale, options).format(latest)
    },
    [format, autoDecimals, locale],
  )

  // Set initial text content
  useEffect(() => {
    if (ref.current) {
      const initial = prefersReducedMotion ? to : direction === 'down' ? to : from
      ref.current.textContent = formatValue(initial)
    }
  }, [from, to, direction, formatValue, prefersReducedMotion])

  // Drive the spring
  useEffect(() => {
    if (!isInView || !startWhen) return
    if (prefersReducedMotion) {
      if (ref.current) ref.current.textContent = formatValue(to)
      onEnd?.()
      return
    }
    onStart?.()
    const start = setTimeout(() => motionValue.set(direction === 'down' ? from : to), delay * 1000)
    const done = setTimeout(() => onEnd?.(), delay * 1000 + duration * 1000)
    return () => {
      clearTimeout(start)
      clearTimeout(done)
    }
  }, [isInView, startWhen, motionValue, direction, from, to, delay, onStart, onEnd, duration, prefersReducedMotion, formatValue])

  useEffect(() => {
    const unsubscribe = springValue.on('change', latest => {
      if (ref.current) ref.current.textContent = formatValue(latest)
    })
    return () => unsubscribe()
  }, [springValue, formatValue])

  return <span className={className} ref={ref} />
}

export default CountUp
