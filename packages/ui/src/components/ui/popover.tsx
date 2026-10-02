'use client'

import { cva } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
import { Popover as PopoverPrimitive } from 'radix-ui'
import type * as React from 'react'

/**
 * Popover — canonical Command Pixel detached floating surface.
 *
 * Radix supplies the interaction contract: portal, Escape close, outside
 * click, focus move on open, focus restoration on close, collision-aware
 * positioning. This is the base for NavDropdown, UserMenu and contextual
 * filters; keep it navigation-agnostic.
 */

function Popover({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

function PopoverTrigger({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

function PopoverAnchor({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />
}

const popoverContent = cva({
  base: {
    zIndex: 'popover',
    w: '72',
    rounded: 'dropdown',
    borderWidth: '1px',
    borderColor: 'border',
    bg: 'popover',
    color: 'popover.foreground',
    p: '3',
    shadow: 'overlay',
    outlineStyle: 'none',
    '@media (forced-colors: active)': { outline: '2px solid transparent', outlineOffset: '2px' },
    transformOrigin: 'var(--radix-popover-content-transform-origin)',
    '&[data-state=open]': { animation: 'scaleIn 150ms ease' },
    '&[data-state=closed]': { animation: 'scaleOut 150ms ease' },
  },
})

const StyledPopoverContent = styled(PopoverPrimitive.Content, popoverContent)

function PopoverContent({
  align = 'center',
  sideOffset = 8,
  ...props
}: React.ComponentProps<typeof StyledPopoverContent>) {
  return (
    <PopoverPrimitive.Portal>
      <StyledPopoverContent
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        collisionPadding={12}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}

function PopoverClose({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Close>) {
  return <PopoverPrimitive.Close data-slot="popover-close" {...props} />
}

export { Popover, PopoverAnchor, PopoverClose, PopoverContent, PopoverTrigger }
