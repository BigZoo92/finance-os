'use client'

import { cva } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
import { Avatar as AvatarPrimitive } from 'radix-ui'

/**
 * Avatar family. The root carries `data-size`; every part reads it through
 * `[data-slot=avatar][data-size=…] &`, which replaces the former named
 * Tailwind group.
 */
const avatarRoot = cva({
  base: {
    position: 'relative',
    display: 'flex',
    flexShrink: '0',
    overflow: 'hidden',
    rounded: 'full',
    userSelect: 'none',
    boxSize: '8',
  },
  variants: {
    size: {
      default: {},
      sm: { boxSize: '6' },
      lg: { boxSize: '10' },
    },
  },
  defaultVariants: { size: 'default' },
})

const avatarImage = cva({
  base: { aspectRatio: 'square', boxSize: 'full' },
})

const avatarFallback = cva({
  base: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSize: 'full',
    rounded: 'full',
    bg: 'muted',
    color: 'muted.foreground',
    textStyle: 'sm',
    '[data-slot=avatar][data-size=sm] &': { textStyle: 'xs' },
  },
})

const avatarBadge = cva({
  base: {
    position: 'absolute',
    right: '0',
    bottom: '0',
    zIndex: '10',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    rounded: 'full',
    bg: 'primary',
    color: 'primary.foreground',
    boxShadow: '0 0 0 2px {colors.background}',
    userSelect: 'none',
    '[data-slot=avatar][data-size=sm] &': { boxSize: '2', '& > svg': { display: 'none' } },
    '[data-slot=avatar][data-size=default] &': { boxSize: '2.5', '& > svg': { boxSize: '2' } },
    '[data-slot=avatar][data-size=lg] &': { boxSize: '3', '& > svg': { boxSize: '2' } },
  },
})

const avatarGroup = cva({
  base: {
    display: 'flex',
    spaceX: '-2',
    '& > [data-slot=avatar]': { boxShadow: '0 0 0 2px {colors.background}' },
  },
})

const avatarGroupCount = cva({
  base: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: '0',
    boxSize: '8',
    rounded: 'full',
    bg: 'muted',
    color: 'muted.foreground',
    textStyle: 'sm',
    boxShadow: '0 0 0 2px {colors.background}',
    '& > svg': { boxSize: '4' },
    '[data-slot=avatar-group]:has([data-size=lg]) &': {
      boxSize: '10',
      '& > svg': { boxSize: '5' },
    },
    '[data-slot=avatar-group]:has([data-size=sm]) &': { boxSize: '6', '& > svg': { boxSize: '3' } },
  },
})

const StyledAvatarRoot = styled(AvatarPrimitive.Root, avatarRoot)

type AvatarSize = 'default' | 'sm' | 'lg'

function Avatar({
  size = 'default',
  ...props
}: React.ComponentProps<typeof StyledAvatarRoot> & { size?: AvatarSize }) {
  return <StyledAvatarRoot data-slot="avatar" data-size={size} size={size} {...props} />
}

const AvatarImage = styled(AvatarPrimitive.Image, avatarImage, {
  defaultProps: { 'data-slot': 'avatar-image' },
})
const AvatarFallback = styled(AvatarPrimitive.Fallback, avatarFallback, {
  defaultProps: { 'data-slot': 'avatar-fallback' },
})
const AvatarBadge = styled('span', avatarBadge, { defaultProps: { 'data-slot': 'avatar-badge' } })
const AvatarGroup = styled('div', avatarGroup, { defaultProps: { 'data-slot': 'avatar-group' } })
const AvatarGroupCount = styled('div', avatarGroupCount, {
  defaultProps: { 'data-slot': 'avatar-group-count' },
})

export { Avatar, AvatarBadge, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage }
