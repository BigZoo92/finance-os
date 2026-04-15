/**
 * PixelBlastBackdrop — brand-tuned PixelBlast wrapper.
 *
 * Defaults follow the React Bits official demo:
 *  https://reactbits.dev/backgrounds/pixel-blast
 *
 *  - `variant="square"` — more graphic / signal-y than circle
 *  - `liquid={false}`   — no pointer-warping of the background. Hover
 *    leaves the canvas alone; ONLY clicks emit a clean propagating ripple.
 *    This is what makes the demo feel elegant — the warp mode we had
 *    before was aggressive and distracted from the login form.
 *  - `edgeFade: 0.25`   — softer corner fade than the canvas default.
 *
 * Finance-OS constraints layered on top:
 *  - SSR-safe (client-only render via `mounted` gate)
 *  - Respects `prefers-reduced-motion` (falls back to static aurora mesh)
 *  - Rose default palette (`#ff4f9f`) instead of the demo's mauve
 */
import { useEffect, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import PixelBlast from '@/components/reactbits/pixel-blast'

type PixelBlastBackdropProps = {
  className?: string
  /** Base pixel colour — defaults to the Aurora rose. */
  color?: string
  /** 0–1 overall opacity. Keep below 0.8 so text on top stays legible. */
  opacity?: number
  /** Pattern shape. */
  variant?: 'square' | 'circle' | 'triangle' | 'diamond'
  /** Pixel size in px. Larger = more graphic, lower GPU cost. */
  pixelSize?: number
  /** Animation speed (0 = frozen). */
  speed?: number
  /** Ripples on click. Leave `true` for a premium, interactive feel. */
  enableRipples?: boolean
  /** When `true` (default) the canvas receives pointer events so clicking
   *  it emits a ripple. Set to `false` for a purely decorative backdrop. */
  interactive?: boolean
}

export function PixelBlastBackdrop({
  className = '',
  color = '#ff4f9f',
  opacity = 0.55,
  variant = 'square',
  pixelSize = 4,
  speed = 0.5,
  enableRipples = true,
  interactive = true,
}: PixelBlastBackdropProps) {
  const prefersReducedMotion = useReducedMotion()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

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
    <div
      aria-hidden="true"
      className={`absolute inset-0 ${interactive ? '' : 'pointer-events-none'} ${className}`}
      style={{ opacity }}
    >
      <PixelBlast
        variant={variant}
        pixelSize={pixelSize}
        color={color}
        patternScale={2}
        patternDensity={1}
        pixelSizeJitter={0}
        enableRipples={enableRipples}
        rippleSpeed={0.4}
        rippleThickness={0.12}
        rippleIntensityScale={1.5}
        /* NO liquid warping — the demo keeps this off for a good reason.
           Clicks still produce ripples (enableRipples above). */
        liquid={false}
        liquidStrength={0.12}
        liquidRadius={1.2}
        liquidWobbleSpeed={5}
        speed={speed}
        edgeFade={0.25}
        transparent
      />
    </div>
  )
}

export default PixelBlastBackdrop
