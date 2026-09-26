'use client'

import { cva } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
import { Tooltip as TooltipPrimitive } from 'radix-ui'
import type * as React from 'react'

/**
 * Tooltip — canonical Command Pixel floating hint.
 *
 * Radix keeps the a11y contract: opens on focus as well as hover (usable
 * without a pointer), wires `aria-describedby`, closes on Escape. Icon-only
 * controls must still carry their own `aria-label`; the tooltip is a visual
 * duplicate, not the accessible name.
 */

function TooltipProvider({
  delayDuration = 300,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

function Tooltip({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

const tooltipContent = cva({
  base: {
    zIndex: 'popover',
    maxW: '280px',
    rounded: 'tile',
    borderWidth: '1px',
    borderColor: 'border',
    bg: 'popover',
    px: '2.5',
    py: '1.5',
    textStyle: 'xs',
    color: 'popover.foreground',
    shadow: 'floating',
    transformOrigin: 'var(--radix-tooltip-content-transform-origin)',
    '&[data-state=delayed-open]': { animation: 'scaleIn 150ms ease' },
    '&[data-state=closed]': { animation: 'fadeOut 150ms ease' },
  },
})

const StyledTooltipContent = styled(TooltipPrimitive.Content, tooltipContent)

function TooltipContent({
  sideOffset = 6,
  children,
  ...props
}: React.ComponentProps<typeof StyledTooltipContent>) {
  return (
    <TooltipPrimitive.Portal>
      <StyledTooltipContent
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        collisionPadding={8}
        {...props}
      >
        {children}
      </StyledTooltipContent>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger }
