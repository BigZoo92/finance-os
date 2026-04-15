/**
 * PixelImageReveal — image that reveals via a pixelated stagger on mount.
 *
 * Adapted from the React Bits PixelTransition idea (gsap stagger over a
 * pixel grid) but:
 *  - auto-runs ONCE on mount (no hover required), which matches how news
 *    cards appear in the feed
 *  - forwards the original <img> markup intact once the reveal completes
 *    so the element stays indexable / accessible
 *  - respects `prefers-reduced-motion` (skips the stagger and just fades in)
 *
 * The parent must be `relative` (the component fills it with `absolute
 * inset-0`).
 */
import { gsap } from 'gsap'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useReducedMotion } from 'motion/react'

type PixelImageRevealProps = {
  /** The image (or any element) to reveal. Usually an `<img>`. */
  children: ReactNode
  gridSize?: number
  pixelColor?: string
  /** Whole-reveal duration (seconds). */
  duration?: number
  /** Delay before starting the reveal (seconds). */
  delay?: number
  className?: string
}

export function PixelImageReveal({
  children,
  gridSize = 10,
  pixelColor = 'oklch(from var(--primary) l c h / 95%)',
  duration = 0.6,
  delay = 0,
  className = '',
}: PixelImageRevealProps) {
  const gridRef = useRef<HTMLDivElement | null>(null)
  const prefersReducedMotion = useReducedMotion()
  const [revealed, setRevealed] = useState(prefersReducedMotion)
  const scopeId = useId().replace(/:/g, '')

  // Build the pixel grid once on mount
  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    grid.innerHTML = ''
    if (prefersReducedMotion) return

    const size = 100 / gridSize
    const pixels: HTMLDivElement[] = []
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const pixel = document.createElement('div')
        pixel.style.position = 'absolute'
        pixel.style.backgroundColor = pixelColor
        pixel.style.width = `${size}%`
        pixel.style.height = `${size}%`
        pixel.style.left = `${col * size}%`
        pixel.style.top = `${row * size}%`
        grid.appendChild(pixel)
        pixels.push(pixel)
      }
    }

    // Stagger random disappearance so the image reveals "from behind the pixels"
    const stagger = duration / pixels.length
    gsap.to(pixels, {
      opacity: 0,
      duration: 0,
      delay,
      stagger: { each: stagger, from: 'random' },
      onComplete: () => {
        setRevealed(true)
        // Remove the dom nodes once done so we don't keep hundreds of divs
        for (const p of pixels) p.remove()
      },
    })

    return () => {
      gsap.killTweensOf(pixels)
      for (const p of pixels) p.remove()
    }
  }, [gridSize, pixelColor, duration, delay, prefersReducedMotion])

  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`} data-pir={scopeId}>
      <div
        className={`absolute inset-0 transition-opacity duration-300 ${
          revealed ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {children}
      </div>
      <div ref={gridRef} aria-hidden="true" className="pointer-events-none absolute inset-0" />
    </div>
  )
}

export default PixelImageReveal
