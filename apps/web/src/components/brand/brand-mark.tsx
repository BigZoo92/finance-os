/**
 * BrandMark — Finance-OS signature mark, canonical Command Pixel form:
 * a framed low-radius icon tile holding the signal orange pixel square.
 * Decorative by default; the accessible name comes from the adjacent
 * "Finance-OS" label in the shell.
 */

type BrandMarkProps = {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  /** Legacy prop kept for API compatibility; the canonical mark has no halo. */
  halo?: boolean
}

const SIZE_MAP: Record<
  'sm' | 'md' | 'lg' | 'xl',
  { box: string; square: string }
> = {
  sm: { box: 'h-6 w-6 rounded-tile', square: 'h-[7px] w-[7px] rounded-[2px]' },
  md: { box: 'h-[26px] w-[26px] rounded-icon-tile', square: 'h-2 w-2 rounded-[2px]' },
  lg: { box: 'h-11 w-11 rounded-dropdown', square: 'h-3.5 w-3.5 rounded-[3px]' },
  xl: { box: 'h-16 w-16 rounded-surface', square: 'h-5 w-5 rounded-[4px]' },
}

export function BrandMark({ size = 'md', className = '' }: BrandMarkProps) {
  const s = SIZE_MAP[size]
  return (
    <span
      aria-hidden="true"
      className={`inline-grid place-items-center border border-foreground/16 bg-primary/12 ${s.box} ${className}`}
    >
      <span className={`bg-primary ${s.square}`} />
    </span>
  )
}

export default BrandMark
