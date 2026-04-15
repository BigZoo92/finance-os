/**
 * SpotlightCard — card with a cursor-following radial-gradient spotlight.
 *
 * Adapted from React Bits (MIT + Commons Clause).
 * Source: https://reactbits.dev/ts/tailwind/Components/SpotlightCard
 *
 * Finance-OS changes:
 *  - Default surface matches the Aurora Pink card tokens instead of a hard
 *    neutral-900 background. Pass `className` for full override.
 *  - Default spotlight color pulled from `var(--primary)`, with `rose` /
 *    `violet` / `aurora` presets for consistency.
 *  - Disabled automatically under `prefers-reduced-motion`.
 */
import { useRef, useState, type PropsWithChildren } from 'react'
import { useReducedMotion } from 'motion/react'

// A presentational wrapper — children handle their own interactivity.
// The div is intentionally inert from a keyboard standpoint; only the
// pointer spotlight is driven from here.

type SpotlightPreset = 'rose' | 'violet' | 'aurora' | 'neutral'

type SpotlightCardProps = PropsWithChildren<{
  className?: string
  spotlightColor?: string
  preset?: SpotlightPreset
  /** Controls the spotlight intensity when the user hovers. 0.3–0.8 recommended. */
  intensity?: number
}>

const PRESETS: Record<SpotlightPreset, string> = {
  rose: 'oklch(from var(--primary) l c h / 38%)',
  violet: 'oklch(from var(--accent-2) l c h / 34%)',
  aurora: 'oklch(from var(--aurora-b) l c h / 36%)',
  neutral: 'oklch(from var(--foreground) l c h / 16%)',
}

export function SpotlightCard({
  children,
  className = '',
  spotlightColor,
  preset = 'rose',
  intensity = 0.55,
}: SpotlightCardProps) {
  const divRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = useReducedMotion()
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [opacity, setOpacity] = useState(0)

  const color = spotlightColor ?? PRESETS[preset]

  const handleMouseMove: React.MouseEventHandler<HTMLDivElement> = e => {
    if (!divRef.current || prefersReducedMotion) return
    const rect = divRef.current.getBoundingClientRect()
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }
  const handleMouseEnter = () => {
    if (!prefersReducedMotion) setOpacity(intensity)
  }
  const handleMouseLeave = () => setOpacity(0)

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: purely presentational pointer tracking, no keyboard semantics exposed
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative overflow-hidden rounded-2xl border border-border/60 bg-card text-card-foreground ${className}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 ease-out"
        style={{
          opacity,
          background: `radial-gradient(320px circle at ${position.x}px ${position.y}px, ${color}, transparent 70%)`,
        }}
      />
      {children}
    </div>
  )
}

export default SpotlightCard
