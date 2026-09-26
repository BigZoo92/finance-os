'use client'

import { cva, cx } from '@finance-os/styled-system/css'
import { ToggleGroup as ToggleGroupPrimitive } from 'radix-ui'
import type * as React from 'react'

/**
 * SegmentedControl — canonical Command Pixel period/filter switch.
 *
 * Replaces the RangePill role with correct semantics: Radix ToggleGroup in
 * single mode exposes a radio group with roving focus and arrow-key
 * navigation. Active state is a filled low-radius tile, visually distinct
 * from hover. Selection cannot be emptied: clicking the active option keeps
 * it selected.
 */

const segmentedControlRoot = cva({
  base: {
    display: 'inline-flex',
    w: 'fit',
    maxW: 'full',
    alignItems: 'center',
    overflowX: 'auto',
    rounded: 'control',
    borderWidth: '1px',
    borderColor: 'border',
    bg: 'surface.1',
    p: '3px',
    fontFamily: 'mono',
  },
  variants: {
    size: {
      sm: { fontSize: '10px' },
      md: { fontSize: '11px' },
    },
  },
  defaultVariants: { size: 'md' },
})

const segmentedControlItem = cva({
  base: {
    flexShrink: '0',
    whiteSpace: 'nowrap',
    rounded: 'tile',
    transitionProperty: 'colors',
    transitionDuration: '150ms',
    transitionTimingFunction: 'default',
    color: 'muted.foreground',
    _hover: { color: 'foreground' },
    // The active tile keeps its brand color under hover (data-* beat hover in Tailwind).
    '&[data-state=on]': { bg: 'primary/12', color: 'primary', _hover: { color: 'primary' } },
    outline: 'none',
    _focusVisible: {
      boxShadow:
        '0 0 0 1px {colors.background}, 0 0 0 3px color-mix(in srgb, {colors.ring} 70%, transparent)',
    },
    _disabled: { pointerEvents: 'none', opacity: '0.4' },
  },
  variants: {
    size: {
      sm: { px: '2.5', py: '1' },
      md: { px: '3', py: '1.5' },
    },
  },
  defaultVariants: { size: 'md' },
})

type SegmentedControlOption<T extends string> = {
  label: React.ReactNode
  value: T
  disabled?: boolean
}

type SegmentedControlProps<T extends string> = {
  options: Array<SegmentedControlOption<T>>
  value: T
  onChange: (next: T) => void
  size?: 'sm' | 'md'
  className?: string
  'aria-label'?: string
  'aria-labelledby'?: string
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  className,
  ...aria
}: SegmentedControlProps<T>) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="segmented-control"
      type="single"
      value={value}
      onValueChange={next => {
        if (next) onChange(next as T)
      }}
      className={cx(segmentedControlRoot({ size }), className)}
      {...aria}
    >
      {options.map(option => (
        <ToggleGroupPrimitive.Item
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          className={segmentedControlItem({ size })}
        >
          {option.label}
        </ToggleGroupPrimitive.Item>
      ))}
    </ToggleGroupPrimitive.Root>
  )
}

export { SegmentedControl, type SegmentedControlOption }
