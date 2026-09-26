/**
 * BrandMark — Finance-OS signature mark, canonical Command Pixel form:
 * a framed low-radius icon tile holding the signal orange pixel square.
 * Decorative by default; the accessible name comes from the adjacent
 * "Finance-OS" label in the shell.
 */
import { cva, cx } from '@finance-os/styled-system/css'

type BrandMarkProps = {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  /** Legacy prop kept for API compatibility; the canonical mark has no halo. */
  halo?: boolean
}

const brandTile = cva({
  base: {
    display: 'inline-grid',
    placeItems: 'center',
    borderWidth: '1px',
    borderColor: 'foreground/16',
    bg: 'primary/12',
  },
  variants: {
    size: {
      sm: { h: '6', w: '6', rounded: 'tile' },
      md: { h: '26px', w: '26px', rounded: 'iconTile' },
      lg: { h: '11', w: '11', rounded: 'dropdown' },
      xl: { h: '16', w: '16', rounded: 'surface' },
    },
  },
})

const brandPixel = cva({
  base: { bg: 'primary' },
  variants: {
    size: {
      sm: { h: '7px', w: '7px', rounded: '2px' },
      md: { h: '2', w: '2', rounded: '2px' },
      lg: { h: '3.5', w: '3.5', rounded: '3px' },
      xl: { h: '5', w: '5', rounded: '4px' },
    },
  },
})

export function BrandMark({ size = 'md', className }: BrandMarkProps) {
  return (
    <span aria-hidden="true" className={cx(brandTile({ size }), className)}>
      <span className={brandPixel({ size })} />
    </span>
  )
}

export default BrandMark
