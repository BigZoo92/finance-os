/**
 * NavIconTile — canonical framed icon tile used across navigation surfaces
 * (dropdown items, mobile tabs, drawer rows). Low radius, thin warm frame,
 * canvas background.
 */
import { cva, cx } from '@finance-os/styled-system/css'
import type { IconComponent } from '@finance-os/ui/icons/types'

type NavIconTileProps = {
  icon: IconComponent
  size?: 'sm' | 'md'
  /** Active tabs get the signal orange frame treatment. */
  active?: boolean
  className?: string
}

const navIconTile = cva({
  base: {
    display: 'grid',
    flexShrink: '0',
    placeItems: 'center',
    borderWidth: '1px',
    transitionProperty: 'colors',
    transitionDuration: '150ms',
    transitionTimingFunction: 'default',
  },
  variants: {
    size: {
      sm: { h: '5', w: '5', rounded: 'tile', '& svg': { h: '3', w: '3' } },
      md: { h: '9', w: '9', rounded: 'control', '& svg': { h: '4', w: '4' } },
    },
    active: {
      true: { borderColor: 'primary', bg: 'primary/12', color: 'primary' },
      false: { borderColor: 'foreground/16', bg: 'background', color: 'foreground/70' },
    },
  },
})

export function NavIconTile({ icon: Icon, size = 'md', active, className }: NavIconTileProps) {
  return (
    <span
      aria-hidden="true"
      className={cx(navIconTile({ size, active: Boolean(active) }), className)}
    >
      <Icon size={size === 'sm' ? 12 : 16} />
    </span>
  )
}

export default NavIconTile
