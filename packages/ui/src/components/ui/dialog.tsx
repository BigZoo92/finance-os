'use client'

import { cva } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
import { Dialog as DialogPrimitive } from 'radix-ui'
import type * as React from 'react'

/**
 * Dialog — canonical Command Pixel modal.
 *
 * Radix supplies the a11y contract: `role="dialog"`, `aria-labelledby` and
 * `aria-describedby` wired to DialogTitle/DialogDescription, focus trap,
 * focus restoration, Escape close and scroll lock. Every dialog must render
 * a DialogTitle (visually hidden if necessary).
 */

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

const dialogOverlay = cva({
  base: {
    position: 'fixed',
    inset: '0',
    zIndex: 'modal',
    bg: 'black/55',
    '&[data-state=open]': { animation: 'fadeIn 150ms ease' },
    '&[data-state=closed]': { animation: 'fadeOut 150ms ease' },
  },
})

const dialogContent = cva({
  base: {
    position: 'fixed',
    left: '50%',
    top: '50%',
    zIndex: 'modal',
    display: 'flex',
    flexDirection: 'column',
    gap: '4',
    w: 'calc(100vw - 2rem)',
    maxW: 'lg',
    maxH: 'calc(100dvh - 4rem)',
    translate: '-50% -50%',
    overflowY: 'auto',
    rounded: 'surface',
    borderWidth: '1px',
    borderColor: 'border',
    bg: 'card',
    color: 'card.foreground',
    p: '5',
    shadow: 'overlay',
    outlineStyle: 'none',
    '@media (forced-colors: active)': { outline: '2px solid transparent', outlineOffset: '2px' },
    md: { p: '6' },
    '&[data-state=open]': { animation: 'scaleIn 150ms ease' },
    '&[data-state=closed]': { animation: 'scaleOut 150ms ease' },
  },
})

const dialogHeader = cva({
  base: { display: 'flex', flexDirection: 'column', gap: '1.5', textAlign: 'left' },
})

const dialogFooter = cva({
  base: {
    display: 'flex',
    flexDirection: 'column-reverse',
    gap: '2',
    sm: { flexDirection: 'row', justifyContent: 'flex-end' },
  },
})

const dialogTitle = cva({
  base: { textStyle: 'md', fontWeight: 'semibold', letterSpacing: 'tight', color: 'foreground' },
})

const dialogDescription = cva({
  base: { fontSize: '13px', color: 'muted.foreground' },
})

const DialogOverlay = styled(DialogPrimitive.Overlay, dialogOverlay, {
  defaultProps: { 'data-slot': 'dialog-overlay' },
})
const StyledDialogContent = styled(DialogPrimitive.Content, dialogContent)

function DialogContent({ children, ...props }: React.ComponentProps<typeof StyledDialogContent>) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <StyledDialogContent data-slot="dialog-content" {...props}>
        {children}
      </StyledDialogContent>
    </DialogPortal>
  )
}

const DialogHeader = styled('div', dialogHeader, { defaultProps: { 'data-slot': 'dialog-header' } })
const DialogFooter = styled('div', dialogFooter, { defaultProps: { 'data-slot': 'dialog-footer' } })
const DialogTitle = styled(DialogPrimitive.Title, dialogTitle, {
  defaultProps: { 'data-slot': 'dialog-title' },
})
const DialogDescription = styled(DialogPrimitive.Description, dialogDescription, {
  defaultProps: { 'data-slot': 'dialog-description' },
})

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
