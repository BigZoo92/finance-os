/**
 * AuroraCanvas — brand-tuned LiquidEther wrapper for hero sections.
 *
 * Finance-OS choreography:
 *  - Fills the parent (position:absolute inset-0) — parent must be `relative`
 *  - Uses the Aurora Pink triad (rose → violet → indigo)
 *  - Respects `prefers-reduced-motion` (falls back to a static CSS mesh)
 *  - SSR-safe (client-only render via `mounted` gate)
 *  - Small-screen gate: below `minViewportWidth` we render the static mesh
 *    instead of the WebGL sim, keeping mobile GPUs happy.
 *  - Conservative simulation defaults (low resolution, few iterations) so
 *    the canvas stays cheap on laptop integrated GPUs.
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
  /** Below this viewport width the WebGL canvas is replaced by the static mesh. */
  minViewportWidth?: number
  /** Simulation resolution (0..1). Lower = faster. Default 0.35. */
  resolution?: number
}

export function AuroraCanvas({
  className = '',
  colors = ['#ff4f9f', '#c084fc', '#7aa2ff'],
  opacity = 0.75,
  mouseForce = 18,
  autoDemo = true,
  minViewportWidth = 900,
  resolution = 0.35,
}: AuroraCanvasProps) {
  const prefersReducedMotion = useReducedMotion()
  const [mounted, setMounted] = useState(false)
  const [allowWebGL, setAllowWebGL] = useState(false)

  useEffect(() => {
    setMounted(true)
    const mq = window.matchMedia(`(min-width: ${minViewportWidth}px)`)
    setAllowWebGL(mq.matches)
    const handler = (e: MediaQueryListEvent) => setAllowWebGL(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [minViewportWidth])

  // Static fallback for reduced-motion, SSR, and small screens.
  if (prefersReducedMotion || !mounted || !allowWebGL) {
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
        cursorSize={90}
        isViscous={false}
        viscous={30}
        // Lowered iterations from the React Bits defaults (24/24) — barely
        // perceptible difference, materially cheaper on laptop iGPUs.
        iterationsViscous={8}
        iterationsPoisson={10}
        resolution={resolution}
        isBounce={false}
        autoDemo={autoDemo}
        autoSpeed={0.35}
        autoIntensity={1.4}
        takeoverDuration={0.25}
        autoResumeDelay={2200}
        autoRampDuration={0.6}
      />
    </div>
  )
}

export default AuroraCanvas
