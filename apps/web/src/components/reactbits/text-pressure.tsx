/**
 * TextPressure — variable-font title that compresses towards the cursor.
 *
 * Adapted from React Bits (MIT + Commons Clause).
 * Source: https://reactbits.dev/text-animations/text-pressure
 * Original codepen: https://codepen.io/JuanFuentes/full/rgXKGQ
 *
 * Finance-OS changes:
 *  - SSR-safe (gates window access on mount)
 *  - Respects `prefers-reduced-motion` — the characters stay static at the
 *    default width/weight when the user opts out of motion
 *  - Defaults aligned with the Aurora Pink hero: no italic, no alpha, keeps
 *    "Compressa VF" for the signature pressure feel
 *  - Stroke path uses CSS `text-stroke` via a data-scoped class so we do not
 *    collide with unrelated `.stroke` rules elsewhere in the app
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'

type TextPressureProps = {
  text?: string
  fontFamily?: string
  fontUrl?: string
  width?: boolean
  weight?: boolean
  italic?: boolean
  alpha?: boolean
  flex?: boolean
  stroke?: boolean
  scale?: boolean
  textColor?: string
  strokeColor?: string
  strokeWidth?: number
  className?: string
  minFontSize?: number
  /** When provided, applies a CSS `background-image` clipped to the text
   *  silhouette (text-fill becomes transparent). Overrides `textColor`. */
  gradient?: string
  /** Semantic tag to render. Default `h1`. Pass `div` when nesting inside
   *  another heading, or `h2` for section titles. */
  as?: 'h1' | 'h2' | 'h3' | 'div' | 'p'
  /** Accessible label. Defaults to `text`. When set, the visible spans
   *  become aria-hidden so screen readers read this instead of individual
   *  characters. */
  ariaLabel?: string
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return Math.sqrt(dx * dx + dy * dy)
}

const getAttr = (distance: number, maxDist: number, minVal: number, maxVal: number) => {
  const val = maxVal - Math.abs((maxVal * distance) / maxDist)
  return Math.max(minVal, val + minVal)
}

function debounce<T extends (...args: unknown[]) => void>(fn: T, delay: number) {
  let id: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(id)
    id = setTimeout(() => fn(...args), delay)
  }
}

export function TextPressure({
  text = 'Cockpit',
  fontFamily = 'Compressa VF',
  fontUrl = 'https://res.cloudinary.com/dr6lvwubh/raw/upload/v1529908256/CompressaPRO-GX.woff2',
  width = true,
  weight = true,
  italic = false,
  alpha = false,
  flex = true,
  stroke = false,
  scale = false,
  textColor = 'currentColor',
  strokeColor = 'var(--primary)',
  strokeWidth = 2,
  className = '',
  minFontSize = 48,
  gradient,
  as = 'h1',
  ariaLabel,
}: TextPressureProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const titleRef = useRef<HTMLHeadingElement | null>(null)
  const spansRef = useRef<Array<HTMLSpanElement | null>>([])

  const mouseRef = useRef({ x: 0, y: 0 })
  const cursorRef = useRef({ x: 0, y: 0 })

  const [fontSize, setFontSize] = useState(minFontSize)
  const [scaleY, setScaleY] = useState(1)
  const [lineHeight, setLineHeight] = useState(1)
  const prefersReducedMotion = useReducedMotion()
  const scopeId = useId().replace(/:/g, '')

  const chars = useMemo(() => text.split(''), [text])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleMouseMove = (e: MouseEvent) => {
      cursorRef.current.x = e.clientX
      cursorRef.current.y = e.clientY
    }
    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0]
      if (!touch) return
      cursorRef.current.x = touch.clientX
      cursorRef.current.y = touch.clientY
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('touchmove', handleTouchMove, { passive: true })

    if (containerRef.current) {
      const { left, top, width: w, height } = containerRef.current.getBoundingClientRect()
      mouseRef.current.x = left + w / 2
      mouseRef.current.y = top + height / 2
      cursorRef.current.x = mouseRef.current.x
      cursorRef.current.y = mouseRef.current.y
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('touchmove', handleTouchMove)
    }
  }, [])

  const setSize = useCallback(() => {
    if (!containerRef.current || !titleRef.current) return
    const { width: containerW, height: containerH } = containerRef.current.getBoundingClientRect()

    let newFontSize = containerW / Math.max(chars.length / 2, 1)
    newFontSize = Math.max(newFontSize, minFontSize)

    setFontSize(newFontSize)
    setScaleY(1)
    setLineHeight(1)

    requestAnimationFrame(() => {
      if (!titleRef.current) return
      const textRect = titleRef.current.getBoundingClientRect()
      if (scale && textRect.height > 0) {
        const yRatio = containerH / textRect.height
        setScaleY(yRatio)
        setLineHeight(yRatio)
      }
    })
  }, [chars.length, minFontSize, scale])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const debounced = debounce(setSize, 100)
    debounced()
    window.addEventListener('resize', debounced)
    return () => window.removeEventListener('resize', debounced)
  }, [setSize])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (prefersReducedMotion) {
      // Freeze characters in their default shape
      spansRef.current.forEach(span => {
        if (span) span.style.fontVariationSettings = `'wght' 500, 'wdth' 100, 'ital' 0`
      })
      return
    }

    let rafId: number
    const animate = () => {
      mouseRef.current.x += (cursorRef.current.x - mouseRef.current.x) / 15
      mouseRef.current.y += (cursorRef.current.y - mouseRef.current.y) / 15

      if (titleRef.current) {
        const titleRect = titleRef.current.getBoundingClientRect()
        const maxDist = titleRect.width / 2

        spansRef.current.forEach(span => {
          if (!span) return

          const rect = span.getBoundingClientRect()
          const charCenter = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
          const d = dist(mouseRef.current, charCenter)

          const wdth = width ? Math.floor(getAttr(d, maxDist, 5, 200)) : 100
          const wght = weight ? Math.floor(getAttr(d, maxDist, 100, 900)) : 400
          const italVal = italic ? getAttr(d, maxDist, 0, 1).toFixed(2) : '0'
          const alphaVal = alpha ? getAttr(d, maxDist, 0, 1).toFixed(2) : '1'

          const next = `'wght' ${wght}, 'wdth' ${wdth}, 'ital' ${italVal}`
          if (span.style.fontVariationSettings !== next) span.style.fontVariationSettings = next
          if (alpha && span.style.opacity !== alphaVal) span.style.opacity = alphaVal
        })
      }

      rafId = requestAnimationFrame(animate)
    }

    animate()
    return () => cancelAnimationFrame(rafId)
  }, [width, weight, italic, alpha, prefersReducedMotion])

  // Scoped @font-face + stroke styles — id prevents collision with other `.stroke` usages.
  // Gradient mode: each <span> paints the same gradient clipped to its own
  // letter silhouette. We inherit the custom property from the parent so the
  // gradient is declared once on the <h1>, and we use `background-size: 100%`
  // on the span with `background-attachment: fixed`-style behaviour approximated
  // by `background-origin: border-box` + responsive `background-size` tuned
  // per-span.
  const styleElement = useMemo(
    () => (
      <style>{`
        @font-face {
          font-family: '${fontFamily}';
          src: url('${fontUrl}') format('woff2');
          font-style: normal;
          font-display: swap;
        }
        .tp-${scopeId} span { position: relative; }
        .tp-${scopeId}.stroke span { color: ${textColor}; }
        .tp-${scopeId}.stroke span::after {
          content: attr(data-char);
          position: absolute; left: 0; top: 0;
          color: transparent; z-index: -1;
          -webkit-text-stroke-width: ${strokeWidth}px;
          -webkit-text-stroke-color: ${strokeColor};
        }
        .tp-${scopeId}.gradient {
          color: transparent !important;
          -webkit-text-fill-color: transparent;
        }
        .tp-${scopeId}.gradient span {
          background-image: var(--tp-gradient);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent !important;
          -webkit-text-fill-color: transparent;
        }
      `}</style>
    ),
    [fontFamily, fontUrl, scopeId, textColor, strokeColor, strokeWidth],
  )

  const gradientMode = typeof gradient === 'string' && gradient.length > 0
  const Tag = as
  const resolvedAriaLabel = ariaLabel ?? text

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-transparent">
      {styleElement}
      {/* Screen readers read the whole word once instead of one span per letter */}
      <span className="sr-only">{resolvedAriaLabel}</span>
      <Tag
        ref={titleRef as React.Ref<HTMLHeadingElement & HTMLParagraphElement & HTMLDivElement>}
        aria-label={resolvedAriaLabel}
        className={`tp-${scopeId} ${flex ? 'flex justify-between' : ''} ${stroke ? 'stroke' : ''} ${gradientMode ? 'gradient' : ''} uppercase select-none ${className}`}
        style={{
          fontFamily,
          fontSize,
          lineHeight,
          transform: `scale(1, ${scaleY})`,
          transformOrigin: 'center top',
          margin: 0,
          fontWeight: 100,
          ...(gradientMode
            ? ({ ['--tp-gradient' as string]: gradient } as React.CSSProperties)
            : stroke
              ? {}
              : { color: textColor }),
        }}
      >
        {chars.map((char, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: chars are stable for the lifetime of `text`
            key={i}
            ref={el => {
              spansRef.current[i] = el
            }}
            data-char={char}
            className="inline-block"
            aria-hidden="true"
          >
            {char}
          </span>
        ))}
      </Tag>
    </div>
  )
}

export default TextPressure
