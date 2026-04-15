/**
 * ActionDock — magnification dock for page-level actions.
 *
 * Wraps React Bits Dock with Finance-OS tokens (rose-tinted hover labels,
 * glass surface, no hard-coded #120F17). Use it as a sticky toolbar for
 * actions like "exporter / filtrer / synchroniser".
 */
import { useMotionValue, useSpring, useTransform, motion } from 'motion/react'
import { useMemo, useRef, useState, useEffect, type ReactNode } from 'react'
import type { MotionValue, SpringOptions } from 'motion/react'

export type ActionDockItem = {
  icon: ReactNode
  label: string
  onClick?: () => void
  href?: string
  disabled?: boolean
  /** Override the rose accent for this item only. */
  tone?: 'brand' | 'violet' | 'positive' | 'negative' | 'plain'
}

type ActionDockProps = {
  items: ActionDockItem[]
  className?: string
  panelHeight?: number
  baseItemSize?: number
  magnification?: number
  distance?: number
  spring?: SpringOptions
  /** Position style. Default `inline` lets it flow with the layout. */
  position?: 'inline' | 'fixed-bottom'
}

const TONE_RING: Record<NonNullable<ActionDockItem['tone']>, string> = {
  brand: 'ring-primary/60',
  violet: 'ring-accent-2/60',
  positive: 'ring-positive/60',
  negative: 'ring-negative/60',
  plain: 'ring-border/60',
}

const TONE_FG: Record<NonNullable<ActionDockItem['tone']>, string> = {
  brand: 'text-primary',
  violet: 'text-accent-2',
  positive: 'text-positive',
  negative: 'text-negative',
  plain: 'text-foreground',
}

export function ActionDock({
  items,
  className = '',
  panelHeight = 60,
  baseItemSize = 44,
  magnification = 64,
  distance = 180,
  spring = { mass: 0.1, stiffness: 160, damping: 14 },
  position = 'inline',
}: ActionDockProps) {
  const mouseX = useMotionValue(Number.POSITIVE_INFINITY)
  const isHovered = useMotionValue(0)

  const maxHeight = useMemo(
    () => Math.max(panelHeight + 28, magnification + magnification / 2 + 6),
    [panelHeight, magnification],
  )
  const heightRow = useTransform(isHovered, [0, 1], [panelHeight, maxHeight])
  const height = useSpring(heightRow, spring)

  const wrapperCx =
    position === 'fixed-bottom'
      ? 'fixed inset-x-0 bottom-6 z-30 flex justify-center pointer-events-none lg:left-[260px]'
      : 'relative flex justify-center'

  return (
    <div className={`${wrapperCx} ${className}`}>
      <motion.div
        style={{ height, scrollbarWidth: 'none' }}
        className="relative flex max-w-full items-center pointer-events-auto"
      >
        <motion.div
          onMouseMove={({ pageX }) => {
            isHovered.set(1)
            mouseX.set(pageX)
          }}
          onMouseLeave={() => {
            isHovered.set(0)
            mouseX.set(Number.POSITIVE_INFINITY)
          }}
          className="glass-surface absolute bottom-2 left-1/2 -translate-x-1/2 flex w-fit items-end gap-3 rounded-2xl border border-border/60 px-4 pb-2 shadow-lg"
          style={{ height: panelHeight }}
          role="toolbar"
          aria-label="Actions rapides"
        >
          {items.map((item, index) => (
            <DockItem
              // biome-ignore lint/suspicious/noArrayIndexKey: dock items are stable
              key={index}
              item={item}
              mouseX={mouseX}
              spring={spring}
              distance={distance}
              magnification={magnification}
              baseItemSize={baseItemSize}
            />
          ))}
        </motion.div>
      </motion.div>
    </div>
  )
}

type DockItemProps = {
  item: ActionDockItem
  mouseX: MotionValue<number>
  spring: SpringOptions
  distance: number
  baseItemSize: number
  magnification: number
}

function DockItem({ item, mouseX, spring, distance, magnification, baseItemSize }: DockItemProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const isHovered = useMotionValue(0)
  const tone = item.tone ?? 'brand'

  const mouseDistance = useTransform(mouseX, val => {
    const rect = ref.current?.getBoundingClientRect() ?? { x: 0, width: baseItemSize }
    return val - rect.x - baseItemSize / 2
  })
  const targetSize = useTransform(
    mouseDistance,
    [-distance, 0, distance],
    [baseItemSize, magnification, baseItemSize],
  )
  const size = useSpring(targetSize, spring)

  const handleClick = () => {
    if (item.disabled) return
    if (item.onClick) item.onClick()
    else if (item.href) window.open(item.href, '_blank', 'noopener,noreferrer')
  }

  return (
    <motion.button
      ref={ref}
      type="button"
      style={{ width: size, height: size }}
      onHoverStart={() => isHovered.set(1)}
      onHoverEnd={() => isHovered.set(0)}
      onFocus={() => isHovered.set(1)}
      onBlur={() => isHovered.set(0)}
      onClick={handleClick}
      disabled={item.disabled}
      className={`relative inline-flex items-center justify-center rounded-2xl border border-border/60 bg-card/80 backdrop-blur transition-all duration-150 hover:ring-2 ${TONE_RING[tone]} disabled:opacity-40 disabled:pointer-events-none`}
      tabIndex={0}
      aria-label={item.label}
    >
      <span className={`text-base ${TONE_FG[tone]}`}>{item.icon}</span>
      <DockLabel isHovered={isHovered}>{item.label}</DockLabel>
    </motion.button>
  )
}

function DockLabel({
  children,
  isHovered,
}: {
  children: ReactNode
  isHovered: MotionValue<number>
}) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const unsubscribe = isHovered.on('change', latest => setIsVisible(latest === 1))
    return () => unsubscribe()
  }, [isHovered])

  return isVisible ? (
    <motion.span
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: -10 }}
      exit={{ opacity: 0, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-border/60 bg-card px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground/90 shadow-sm"
      role="tooltip"
    >
      {children}
    </motion.span>
  ) : null
}

export default ActionDock
