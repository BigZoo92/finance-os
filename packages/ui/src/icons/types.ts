import type { ComponentType, SVGProps } from 'react'

/**
 * Props accepted by every vendored Finance-OS pixel icon.
 *
 * Icons render at `size` (default 16) and inherit colour through `fill="currentColor"`,
 * so colour comes from Finance-OS tokens on the surrounding element, never from a prop.
 * A Tailwind `size-*` class still wins over the width/height attributes when needed.
 *
 * Icons default to `aria-hidden="true"`. Pass `role="img"` plus `aria-label` only when the
 * icon carries information no adjacent text provides.
 */
export type PixelIconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & {
  size?: number | string
}

/**
 * Shape for the few places that legitimately store an icon *component* rather than render one
 * (navigation metadata, dock items). Deliberately narrow so both vendored pixel icons and
 * Phosphor fallbacks satisfy it without a wrapper.
 */
export type IconComponent = ComponentType<{ size?: number | string; className?: string }>
