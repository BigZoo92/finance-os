/**
 * ShinyText — gradient shimmer that sweeps across the text.
 *
 * Adapted from React Bits (MIT + Commons Clause).
 * Source: https://reactbits.dev/ts/tailwind/TextAnimations/ShinyText
 *
 * Finance-OS changes:
 *  - Default colors pulled from Aurora tokens so it theme-switches correctly
 *  - Respects `prefers-reduced-motion` — freezes the shimmer on the left edge
 *  - Defaults to `display: inline` so it composes with heading typography
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionStyle,
} from 'motion/react'

type ShinyTextProps = {
  text: string
  disabled?: boolean
  speed?: number
  className?: string
  /** Base text color (the part that is NOT the shine). Defaults to muted foreground. */
  color?: string
  /** Peak shine color. Defaults to primary. */
  shineColor?: string
  spread?: number
  yoyo?: boolean
  pauseOnHover?: boolean
  direction?: 'left' | 'right'
  delay?: number
}

export function ShinyText({
  text,
  disabled = false,
  speed = 3.5,
  className = '',
  color = 'var(--muted-foreground)',
  shineColor = 'var(--primary)',
  spread = 110,
  yoyo = false,
  pauseOnHover = false,
  direction = 'left',
  delay = 0,
}: ShinyTextProps) {
  const [isPaused, setIsPaused] = useState(false)
  const prefersReducedMotion = useReducedMotion()
  const progress = useMotionValue(0)
  const elapsedRef = useRef(0)
  const lastTimeRef = useRef<number | null>(null)
  const directionRef = useRef(direction === 'left' ? 1 : -1)

  const animationDuration = speed * 1000
  const delayDuration = delay * 1000

  useAnimationFrame(time => {
    if (disabled || isPaused || prefersReducedMotion) {
      lastTimeRef.current = null
      return
    }
    if (lastTimeRef.current === null) {
      lastTimeRef.current = time
      return
    }
    const deltaTime = time - lastTimeRef.current
    lastTimeRef.current = time
    elapsedRef.current += deltaTime

    if (yoyo) {
      const cycleDuration = animationDuration + delayDuration
      const fullCycle = cycleDuration * 2
      const cycleTime = elapsedRef.current % fullCycle
      if (cycleTime < animationDuration) {
        const p = (cycleTime / animationDuration) * 100
        progress.set(directionRef.current === 1 ? p : 100 - p)
      } else if (cycleTime < cycleDuration) {
        progress.set(directionRef.current === 1 ? 100 : 0)
      } else if (cycleTime < cycleDuration + animationDuration) {
        const reverseTime = cycleTime - cycleDuration
        const p = 100 - (reverseTime / animationDuration) * 100
        progress.set(directionRef.current === 1 ? p : 100 - p)
      } else {
        progress.set(directionRef.current === 1 ? 0 : 100)
      }
    } else {
      const cycleDuration = animationDuration + delayDuration
      const cycleTime = elapsedRef.current % cycleDuration
      if (cycleTime < animationDuration) {
        const p = (cycleTime / animationDuration) * 100
        progress.set(directionRef.current === 1 ? p : 100 - p)
      } else {
        progress.set(directionRef.current === 1 ? 100 : 0)
      }
    }
  })

  useEffect(() => {
    directionRef.current = direction === 'left' ? 1 : -1
    elapsedRef.current = 0
    progress.set(prefersReducedMotion ? 50 : 0)
  }, [direction, prefersReducedMotion, progress])

  const backgroundPosition = useTransform(progress, p => `${150 - p * 2}% center`)

  const handleMouseEnter = useCallback(() => {
    if (pauseOnHover) setIsPaused(true)
  }, [pauseOnHover])
  const handleMouseLeave = useCallback(() => {
    if (pauseOnHover) setIsPaused(false)
  }, [pauseOnHover])

  const style: MotionStyle = {
    backgroundImage: `linear-gradient(${spread}deg, ${color} 0%, ${color} 35%, ${shineColor} 50%, ${color} 65%, ${color} 100%)`,
    backgroundSize: '200% auto',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    color: 'transparent',
    backgroundPosition,
  }

  return (
    <motion.span
      className={`inline-block ${className}`}
      style={style}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {text}
    </motion.span>
  )
}

export default ShinyText
