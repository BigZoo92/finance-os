'use client'

import { cva, cx } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
import {
  CheckPixelIcon,
  ChevronDownPixelIcon,
  ChevronUpPixelIcon,
} from '@finance-os/ui/icons/pixel'
import { Select as SelectPrimitive } from 'radix-ui'
import type * as React from 'react'

/**
 * Select — canonical accessible replacement for raw `<select>` usages.
 *
 * Radix supplies keyboard behavior (typeahead, arrows, Home/End), focus
 * management, portal rendering and popper collision handling. Compact
 * low-radius Command Pixel styling.
 */

const selectTrigger = cva({
  base: {
    display: 'flex',
    w: 'fit',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '2',
    rounded: 'control',
    borderWidth: '1px',
    borderColor: 'input',
    bg: 'transparent',
    px: '3',
    textStyle: 'sm',
    color: 'foreground',
    whiteSpace: 'nowrap',
    transitionProperty: 'colors',
    transitionDuration: '150ms',
    transitionTimingFunction: 'default',
    _hover: { borderColor: 'primary/30' },
    outline: 'none',
    _focusVisible: {
      boxShadow:
        '0 0 0 2px {colors.background}, 0 0 0 4px color-mix(in srgb, {colors.ring} 70%, transparent)',
    },
    _disabled: { pointerEvents: 'none', opacity: '0.4' },
    '&[data-placeholder]': { color: 'muted.foreground' },
    '& svg': { pointerEvents: 'none', flexShrink: '0' },
  },
  variants: {
    size: {
      default: { h: '9' },
      sm: { h: '8', textStyle: 'xs' },
    },
  },
  defaultVariants: { size: 'default' },
})

const selectContent = cva({
  base: {
    position: 'relative',
    zIndex: 'popover',
    minW: '8rem',
    overflowY: 'auto',
    overflowX: 'hidden',
    rounded: 'dropdown',
    borderWidth: '1px',
    borderColor: 'border',
    bg: 'popover',
    color: 'popover.foreground',
    shadow: 'overlay',
    maxH: 'var(--radix-select-content-available-height)',
    transformOrigin: 'var(--radix-select-content-transform-origin)',
    '&[data-state=open]': { animation: 'scaleIn 150ms ease' },
    '&[data-state=closed]': { animation: 'fadeOut 150ms ease' },
    transitionDuration: '150ms',
  },
  variants: {
    position: {
      popper: {
        '&[data-side=bottom]': { translate: '0 {spacing.1}' },
        '&[data-side=top]': { translate: '0 calc({spacing.1} * -1)' },
      },
      'item-aligned': {},
    },
  },
  defaultVariants: { position: 'popper' },
})

const selectViewport = cva({
  base: { p: '1' },
  variants: {
    position: {
      popper: {
        h: 'var(--radix-select-trigger-height)',
        w: 'full',
        minW: 'var(--radix-select-trigger-width)',
        scrollMarginY: '1',
      },
      'item-aligned': {},
    },
  },
  defaultVariants: { position: 'popper' },
})

const selectLabel = cva({
  base: {
    px: '2',
    py: '1.5',
    fontFamily: 'mono',
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.16em',
    color: 'muted.foreground',
  },
})

const selectItem = cva({
  base: {
    position: 'relative',
    display: 'flex',
    w: 'full',
    cursor: 'default',
    userSelect: 'none',
    alignItems: 'center',
    gap: '2',
    rounded: 'tile',
    py: '1.5',
    pl: '2',
    pr: '8',
    textStyle: 'sm',
    outlineStyle: 'none',
    '@media (forced-colors: active)': { outline: '2px solid transparent', outlineOffset: '2px' },
    _focus: { bg: 'accent', color: 'accent.foreground' },
    '&[data-disabled]': { pointerEvents: 'none', opacity: '0.4' },
  },
})

const selectItemIndicator = cva({
  base: {
    position: 'absolute',
    right: '2',
    display: 'flex',
    boxSize: '3.5',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'primary',
  },
})

const selectSeparator = cva({
  base: { pointerEvents: 'none', mx: '-1', my: '1', h: '1px', bg: 'border' },
})

const selectScrollButton = cva({
  base: {
    display: 'flex',
    cursor: 'default',
    alignItems: 'center',
    justifyContent: 'center',
    py: '1',
  },
})

function Select({ ...props }: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />
}

function SelectGroup({ ...props }: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />
}

function SelectValue({ ...props }: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />
}

function SelectTrigger({
  className,
  size = 'default',
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: 'sm' | 'default'
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cx(selectTrigger({ size }), className)}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownPixelIcon size={14} aria-hidden="true" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  position = 'popper',
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        position={position}
        collisionPadding={8}
        className={cx(selectContent({ position }), className)}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport className={selectViewport({ position })}>
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

const SelectLabel = styled(SelectPrimitive.Label, selectLabel, {
  defaultProps: { 'data-slot': 'select-label' },
})

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cx(selectItem(), className)}
      {...props}
    >
      <span className={selectItemIndicator()}>
        <SelectPrimitive.ItemIndicator>
          <CheckPixelIcon size={13} aria-hidden="true" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

const SelectSeparator = styled(SelectPrimitive.Separator, selectSeparator, {
  defaultProps: { 'data-slot': 'select-separator' },
})

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cx(selectScrollButton(), className)}
      {...props}
    >
      <ChevronUpPixelIcon size={13} aria-hidden="true" />
    </SelectPrimitive.ScrollUpButton>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cx(selectScrollButton(), className)}
      {...props}
    >
      <ChevronDownPixelIcon size={13} aria-hidden="true" />
    </SelectPrimitive.ScrollDownButton>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
