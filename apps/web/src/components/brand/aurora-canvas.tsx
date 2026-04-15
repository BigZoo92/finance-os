/**
 * AuroraCanvas — brand-tuned LiquidEther wrapper for hero sections.
 *
 * Finance-OS choreography:
 *  - Fills the parent (position:absolute inset-0) — parent must be `relative`
 *  - Uses the Aurora Pink triad (`--primary`, `--accent-2`, aurora tokens)
 *  - Respects `prefers-reduced-motion` (falls back to a static CSS mesh)
 *  - SSR-safe (client-only render via dynamic gate on window)
 *  - Z-order stays under its siblings with `-z-10`
 */
import { useEffect, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import LiquidEther from '@/components/reactbits/liquid-ether'

type AuroraCanvasProps = {
  className?: string
  /** Override the Aurora palette (CSS colors only, not tokens). */
  colors?: [string, string, string]
  /** Overall canvas opacity. Defaults to 0.75 so text stays legible on top. */
  opacity?: number
  /** Mouse force multiplier. Default tuned for a calm cockpit. */
  mouseForce?: number
  /** Auto-demo motion when the user is idle. Enabled by default. */
  autoDemo?: boolean
}

export function AuroraCanvas({
  className = '',
  colors = ['#ff4f9f', '#c084fc', '#7aa2ff'],
  opacity = 0.75,
  mouseForce = 18,
  autoDemo = true,
}: AuroraCanvasProps) {
  const prefersReducedMotion = useReducedMotion()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Static fallback for reduced-motion and SSR.
  if (prefersReducedMotion || !mounted) {
    return (
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 bg-aurora-mesh ${className}`}
        style={{ opacity }}
      />
    )
  }

  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 ${className}`} style={{ opacity }}>
      <LiquidEther
        colors={colors}
        mouseForce={mouseForce}
        cursorSize={100}
        isViscous={false}
        viscous={30}
        iterationsViscous={24}
        iterationsPoisson={24}
        resolution={0.5}
        isBounce={false}
        autoDemo={autoDemo}
        autoSpeed={0.45}
        autoIntensity={1.8}
        takeoverDuration={0.25}
        autoResumeDelay={1800}
        autoRampDuration={0.6}
      />
    </div>
  )
}

export default AuroraCanvas
