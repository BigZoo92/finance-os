/**
 * BrandMark — Finance-OS signature logo in multiple sizes.
 *
 * Built from our tokens: an Aurora conic gradient behind a glyph, with an
 * optional slow halo rotation. Respects `prefers-reduced-motion`.
 */
import { motion, useReducedMotion } from 'motion/react'

type BrandMarkProps = {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  glyph?: string
  className?: string
  /** Render the slow halo behind the mark. Default true on `md`+. */
  halo?: boolean
}

const SIZE_MAP: Record<'sm' | 'md' | 'lg' | 'xl', { box: string; glyph: string }> = {
  sm: { box: 'h-7 w-7 rounded-lg', glyph: 'text-[13px]' },
  md: { box: 'h-9 w-9 rounded-xl', glyph: 'text-[15px]' },
  lg: { box: 'h-14 w-14 rounded-2xl', glyph: 'text-xl' },
  xl: { box: 'h-20 w-20 rounded-[22px]', glyph: 'text-3xl' },
}

export function BrandMark({ size = 'md', glyph = '◈', className = '', halo }: BrandMarkProps) {
  const prefersReducedMotion = useReducedMotion()
  const showHalo = halo ?? (size !== 'sm')
  const s = SIZE_MAP[size]

  return (
    <span className={`relative inline-flex items-center justify-center ${s.box} ${className}`}>
      {/* Halo — conic gradient ring that slowly rotates */}
      {showHalo && (
        <motion.span
          aria-hidden="true"
          className="absolute inset-[-2px] rounded-[inherit]"
          style={{
            background:
              'conic-gradient(from 0deg, var(--aurora-a), var(--aurora-b), var(--aurora-c), var(--aurora-a))',
            filter: 'blur(0.5px)',
            WebkitMaskImage: 'radial-gradient(circle, transparent 58%, black 61%)',
            maskImage: 'radial-gradient(circle, transparent 58%, black 61%)',
          }}
          {...(prefersReducedMotion
            ? {}
            : {
                animate: { rotate: 360 },
                transition: { duration: 18, repeat: Infinity, ease: 'linear' as const },
              })}
        />
      )}
      {/* Core — aurora gradient, inset */}
      <span
        className={`relative flex h-full w-full items-center justify-center rounded-[inherit] text-primary-foreground font-semibold ${s.glyph}`}
        style={{
          background:
            'linear-gradient(152deg, var(--aurora-a) 0%, var(--aurora-b) 55%, var(--aurora-c) 100%)',
          boxShadow:
            'inset 0 1px 0 oklch(1 0 0 / 28%), 0 6px 20px -8px oklch(from var(--primary) l c h / 55%)',
        }}
      >
        {glyph}
      </span>
    </span>
  )
}

export default BrandMark
