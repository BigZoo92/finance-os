/**
 * AuroraShape — decorative aurora-colored blob.
 *
 * Inspired by React Bits' ShapeBlur (https://reactbits.dev/animations/shape-blur)
 * but replaces the heavy WebGL/shader dependency with a pure CSS conic +
 * radial gradient that follows the Aurora Pink palette and is virtually
 * free on mobile. Used behind hero sections and signature cards.
 */
import { useMemo } from 'react'
import { useReducedMotion } from 'motion/react'

type AuroraShapeProps = {
  className?: string
  /** Optical size of the blob. */
  size?: number
  /** 0.0 – 1.0 — overall alpha of the blob. */
  intensity?: number
  /** When true, the blob slowly drifts. */
  animated?: boolean
  /** Blur radius in px. */
  blur?: number
}

export function AuroraShape({
  className = '',
  size = 520,
  intensity = 0.55,
  animated = true,
  blur = 100,
}: AuroraShapeProps) {
  const prefersReducedMotion = useReducedMotion()
  const shouldAnimate = animated && !prefersReducedMotion

  const styles = useMemo<React.CSSProperties>(
    () => ({
      width: size,
      height: size,
      opacity: intensity,
      filter: `blur(${blur}px) saturate(135%)`,
    }),
    [size, intensity, blur],
  )

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute rounded-full ${
        shouldAnimate ? 'animate-aurora' : ''
      } ${className}`}
      style={{
        ...styles,
        backgroundImage:
          'conic-gradient(from 140deg at 50% 50%, var(--aurora-a) 0%, var(--aurora-b) 32%, var(--aurora-c) 58%, var(--aurora-a) 100%)',
        // `background-size` & position come from `.animate-aurora`
      }}
    />
  )
}

export default AuroraShape
