/**
 * PixelBlastBackdrop — brand-tuned PixelBlast wrapper for pages where we
 * want a more graphic, signal-y background (e.g. login, special marketing
 * moments).
 *
 * Finance-OS constraints:
 *  - SSR-safe (client-only render via `mounted` gate)
 *  - Respects `prefers-reduced-motion` (falls back to static aurora mesh)
 *  - Uses CSS-var default colors so dark/light both work
 *  - Performance-friendly defaults (low pattern density, ripples off)
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
  /** Whether to enable the cursor ripples (click / hover). */
  enableRipples?: boolean
  /** When `true` (default) the canvas receives pointer events so the user's
   *  mouse triggers liquid warping + ripples. Set to `false` to make the
   *  backdrop purely decorative. */
  interactive?: boolean
}

export function PixelBlastBackdrop({
  className = '',
  color = '#ff4f9f',
  opacity = 0.55,
  variant = 'circle',
  pixelSize = 6,
  speed = 0.45,
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

  // When interactive, the wrapper accepts pointer events so PixelBlast's
  // internal cursor ripples + liquid warping react to click / hover.
  // Foreground UI should sit in a sibling with its own stacking context —
  // it will naturally capture its own pointer events first.
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
        patternScale={3.5}
        patternDensity={1.0}
        pixelSizeJitter={0.5}
        enableRipples={enableRipples}
        rippleSpeed={0.55}
        rippleThickness={0.14}
        rippleIntensityScale={2.2}
        liquid
        liquidStrength={0.12}
        liquidRadius={1.2}
        liquidWobbleSpeed={5}
        speed={speed}
        edgeFade={0.4}
        transparent
      />
    </div>
  )
}

export default PixelBlastBackdrop
