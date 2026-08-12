/**
 * NavIconTile — canonical framed icon tile used across navigation surfaces
 * (dropdown items, mobile tabs, drawer rows). Low radius, thin warm frame,
 * canvas background.
 */
import type { IconComponent } from '@finance-os/ui/icons/types'

type NavIconTileProps = {
  icon: IconComponent
  size?: 'sm' | 'md'
  /** Active tabs get the signal orange frame treatment. */
  active?: boolean
  className?: string
}

export function NavIconTile({ icon: Icon, size = 'md', active, className = '' }: NavIconTileProps) {
  const box =
    size === 'sm'
      ? 'h-5 w-5 rounded-tile [&_svg]:h-3 [&_svg]:w-3'
      : 'h-9 w-9 rounded-control [&_svg]:h-4 [&_svg]:w-4'
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center border transition-colors duration-150 ${box} ${
        active
          ? 'border-primary bg-primary/12 text-primary'
          : 'border-foreground/16 bg-background text-foreground/70'
      } ${className}`}
    >
      <Icon size={size === 'sm' ? 12 : 16} />
    </span>
  )
}

export default NavIconTile
