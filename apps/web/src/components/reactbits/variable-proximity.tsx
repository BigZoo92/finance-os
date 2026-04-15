/**
 * VariableProximity — variable-font characters that react to cursor distance.
 *
 * Adapted from React Bits (MIT + Commons Clause).
 * Source: https://reactbits.dev/ts/tailwind/TextAnimations/VariableProximity
 *
 * Finance-OS changes:
 *  - Uses Inter Variable (already loaded) by default — the `wght` axis is
 *    enough for a subtle section-title flourish. Callers may override.
 *  - SSR-safe; no-ops under `prefers-reduced-motion` (keeps the `from` shape)
 */
import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type HTMLAttributes,
  type MutableRefObject,
} from 'react'
import { motion, useReducedMotion } from 'motion/react'

function useAnimationFrameLoop(callback: () => void) {
  useEffect(() => {
    let frameId: number
    const loop = () => {
      callback()
      frameId = requestAnimationFrame(loop)
    }
    frameId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frameId)
  }, [callback])
}

function useMousePositionRef(containerRef: MutableRefObject<HTMLElement | null>) {
  const positionRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const update = (x: number, y: number) => {
      if (containerRef?.current) {
        const rect = containerRef.current.getBoundingClientRect()
        positionRef.current = { x: x - rect.left, y: y - rect.top }
      } else {
        positionRef.current = { x, y }
      }
    }
    const mouse = (e: MouseEvent) => update(e.clientX, e.clientY)
    const touch = (e: TouchEvent) => {
      const t = e.touches[0]
      if (!t) return
      update(t.clientX, t.clientY)
    }
    window.addEventListener('mousemove', mouse)
    window.addEventListener('touchmove', touch)
    return () => {
      window.removeEventListener('mousemove', mouse)
      window.removeEventListener('touchmove', touch)
    }
  }, [containerRef])

  return positionRef
}

type VariableProximityProps = HTMLAttributes<HTMLSpanElement> & {
  label: string
  /** e.g. "'wght' 400, 'opsz' 14" */
  fromFontVariationSettings?: string
  toFontVariationSettings?: string
  containerRef: MutableRefObject<HTMLElement | null>
  radius?: number
  falloff?: 'linear' | 'exponential' | 'gaussian'
  className?: string
  onClick?: () => void
  style?: CSSProperties
  fontFamily?: string
}

export const VariableProximity = forwardRef<HTMLSpanElement, VariableProximityProps>((props, ref) => {
  const {
    label,
    fromFontVariationSettings = "'wght' 500, 'opsz' 14",
    toFontVariationSettings = "'wght' 900, 'opsz' 32",
    containerRef,
    radius = 80,
    falloff = 'gaussian',
    className = '',
    onClick,
    style,
    fontFamily = '"Inter Variable", Inter, system-ui, sans-serif',
    ...restProps
  } = props

  const letterRefs = useRef<Array<HTMLSpanElement | null>>([])
  const interpolatedSettingsRef = useRef<string[]>([])
  const mousePositionRef = useMousePositionRef(containerRef)
  const lastPositionRef = useRef<{ x: number | null; y: number | null }>({ x: null, y: null })
  const prefersReducedMotion = useReducedMotion()

  const parsedSettings = useMemo(() => {
    const parse = (s: string) =>
      new Map(
        s
          .split(',')
          .map(part => part.trim())
          .map(part => {
            const [name, value] = part.split(' ')
            return [String(name).replace(/['"]/g, ''), parseFloat(value ?? '0')] as const
          }),
      )
    const from = parse(fromFontVariationSettings)
    const to = parse(toFontVariationSettings)
    return Array.from(from.entries()).map(([axis, fromValue]) => ({
      axis,
      fromValue,
      toValue: to.get(axis) ?? fromValue,
    }))
  }, [fromFontVariationSettings, toFontVariationSettings])

  const calcDistance = (x1: number, y1: number, x2: number, y2: number) =>
    Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)

  const calcFalloff = (distance: number) => {
    const norm = Math.min(Math.max(1 - distance / radius, 0), 1)
    switch (falloff) {
      case 'exponential':
        return norm ** 2
      case 'gaussian':
        return Math.exp(-((distance / (radius / 2)) ** 2) / 2)
      default:
        return norm
    }
  }

  useAnimationFrameLoop(() => {
    if (prefersReducedMotion || !containerRef?.current) return
    const { x, y } = mousePositionRef.current
    if (lastPositionRef.current.x === x && lastPositionRef.current.y === y) return
    lastPositionRef.current = { x, y }
    const containerRect = containerRef.current.getBoundingClientRect()

    letterRefs.current.forEach((letterRef, index) => {
      if (!letterRef) return
      const rect = letterRef.getBoundingClientRect()
      const letterCenterX = rect.left + rect.width / 2 - containerRect.left
      const letterCenterY = rect.top + rect.height / 2 - containerRect.top
      const d = calcDistance(mousePositionRef.current.x, mousePositionRef.current.y, letterCenterX, letterCenterY)

      if (d >= radius) {
        letterRef.style.fontVariationSettings = fromFontVariationSettings
        return
      }

      const falloffValue = calcFalloff(d)
      const next = parsedSettings
        .map(({ axis, fromValue, toValue }) => `'${axis}' ${fromValue + (toValue - fromValue) * falloffValue}`)
        .join(', ')
      interpolatedSettingsRef.current[index] = next
      letterRef.style.fontVariationSettings = next
    })
  })

  const words = label.split(' ')
  let letterIndex = 0

  const clickProps = onClick
    ? {
        onClick,
        onKeyDown: (e: React.KeyboardEvent<HTMLSpanElement>) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClick()
          }
        },
        role: 'button' as const,
        tabIndex: 0,
      }
    : {}
  return (
    <span
      ref={ref}
      {...clickProps}
      style={{ display: 'inline', fontFamily, ...style }}
      className={className}
      {...restProps}
    >
      {words.map((word, wordIndex) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: words are transient per render
        <span key={wordIndex} className="inline-block whitespace-nowrap">
          {word.split('').map(letter => {
            const i = letterIndex++
            return (
              <motion.span
                key={i}
                ref={el => {
                  letterRefs.current[i] = el
                }}
                style={{
                  display: 'inline-block',
                  fontVariationSettings: prefersReducedMotion ? fromFontVariationSettings : interpolatedSettingsRef.current[i],
                }}
                aria-hidden="true"
              >
                {letter}
              </motion.span>
            )
          })}
          {wordIndex < words.length - 1 && <span className="inline-block">&nbsp;</span>}
        </span>
      ))}
      <span className="sr-only">{label}</span>
    </span>
  )
})

VariableProximity.displayName = 'VariableProximity'
export default VariableProximity
