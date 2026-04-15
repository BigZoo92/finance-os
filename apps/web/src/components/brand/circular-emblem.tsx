/**
 * CircularEmblem — Aurora-tuned CircularText wrapper that orbits a child
 * (typically a BrandMark or a glyph). Use as a brand accent on hero
 * surfaces and KPIs that deserve a signature halo.
 */
import type { ReactNode } from 'react'
import { CircularText } from '@/components/reactbits/circular-text'

type CircularEmblemProps = {
  text: string
  size?: number
  /** Spin duration in seconds. */
  spinDuration?: number
  onHover?: 'slowDown' | 'speedUp' | 'pause' | 'goBonkers'
  /** What sits inside the orbit. */
  children?: ReactNode
  className?: string
  /** Override text colour. Defaults to primary at 80%. */
  textClassName?: string
}

export function CircularEmblem({
  text,
  size = 148,
  spinDuration = 22,
  onHover = 'speedUp',
  children,
  className = '',
  textClassName = '!text-primary/85 !text-[10px] !tracking-[0.28em] !font-mono !font-semibold',
}: CircularEmblemProps) {
  const dim = `${size}px`
  return (
    <div className={`relative inline-block ${className}`} style={{ width: dim, height: dim }}>
      <CircularText
        text={text}
        spinDuration={spinDuration}
        onHover={onHover}
        className={`!w-full !h-full ${textClassName}`}
      />
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">{children}</div>
      )}
    </div>
  )
}

export default CircularEmblem
