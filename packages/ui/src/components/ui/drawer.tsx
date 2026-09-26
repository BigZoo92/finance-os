'use client'

import { cva } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
import { Dialog as DialogPrimitive } from 'radix-ui'
import type * as React from 'react'

/**
 * Drawer — canonical Command Pixel sheet, built on Radix Dialog.
 *
 * Bottom is the mobile pattern (mobile More navigation, contextual mobile
 * actions); `side="right"` exists for wide drilldowns. Inherits the Dialog
 * a11y contract: focus trap, focus restoration, Escape, scroll lock,
 * `aria-labelledby` via DrawerTitle. No drag physics by design.
 */

type DrawerSide = 'bottom' | 'right'

function Drawer({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="drawer" {...props} />
}

function DrawerTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="drawer-trigger" {...props} />
}

function DrawerClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="drawer-close" {...props} />
}

const drawerOverlay = cva({
  base: {
    position: 'fixed',
    inset: '0',
    zIndex: 'drawer',
    bg: 'black/55',
    '&[data-state=open]': { animation: 'fadeIn 150ms ease' },
    '&[data-state=closed]': { animation: 'fadeOut 150ms ease' },
  },
})

const drawerContent = cva({
  base: {
    position: 'fixed',
    zIndex: 'drawer',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    borderColor: 'border',
    bg: 'card',
    color: 'card.foreground',
    shadow: 'overlay',
    outlineStyle: 'none',
    '@media (forced-colors: active)': { outline: '2px solid transparent', outlineOffset: '2px' },
  },
  variants: {
    side: {
      bottom: {
        insetX: '0',
        bottom: '0',
        maxH: '85dvh',
        w: 'full',
        roundedTop: 'frame',
        borderTopWidth: '1px',
        pb: 'max(1.25rem, env(safe-area-inset-bottom))',
        '&[data-state=open]': { animation: 'slideInFromBottom 200ms ease' },
        '&[data-state=closed]': { animation: 'slideOutToBottom 200ms ease' },
      },
      right: {
        insetY: '0',
        right: '0',
        h: 'full',
        w: 'min(420px, calc(100vw - 2rem))',
        borderLeftWidth: '1px',
        '&[data-state=open]': { animation: 'slideInFromRight 200ms ease' },
        '&[data-state=closed]': { animation: 'slideOutToRight 200ms ease' },
      },
    },
  },
  defaultVariants: { side: 'bottom' },
})

const DrawerOverlay = styled(DialogPrimitive.Overlay, drawerOverlay, {
  defaultProps: { 'data-slot': 'drawer-overlay' },
})
const StyledDrawerContent = styled(DialogPrimitive.Content, drawerContent)

function DrawerContent({
  children,
  side = 'bottom',
  ...props
}: React.ComponentProps<typeof StyledDrawerContent> & { side?: DrawerSide }) {
  return (
    <DialogPrimitive.Portal data-slot="drawer-portal">
      <DrawerOverlay />
      <StyledDrawerContent data-slot="drawer-content" side={side} {...props}>
        {children}
      </StyledDrawerContent>
    </DialogPrimitive.Portal>
  )
}

const drawerHeader = cva({
  base: { display: 'flex', flexDirection: 'column', gap: '1', px: '5', pt: '5', pb: '3' },
})

const drawerFooter = cva({
  base: { mt: 'auto', display: 'flex', flexDirection: 'column', gap: '2', px: '5', pb: '5' },
})

const drawerTitle = cva({
  base: { textStyle: 'md', fontWeight: 'semibold', letterSpacing: 'tight', color: 'foreground' },
})

const drawerDescription = cva({
  base: { fontSize: '13px', color: 'muted.foreground' },
})

const DrawerHeader = styled('div', drawerHeader, { defaultProps: { 'data-slot': 'drawer-header' } })
const DrawerFooter = styled('div', drawerFooter, { defaultProps: { 'data-slot': 'drawer-footer' } })
const DrawerTitle = styled(DialogPrimitive.Title, drawerTitle, {
  defaultProps: { 'data-slot': 'drawer-title' },
})
const DrawerDescription = styled(DialogPrimitive.Description, drawerDescription, {
  defaultProps: { 'data-slot': 'drawer-description' },
})

export {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
}
