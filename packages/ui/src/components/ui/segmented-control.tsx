"use client"

import type * as React from "react"
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui"

import { cn } from "@finance-os/ui/lib/utils"

/**
 * SegmentedControl — canonical Command Pixel period/filter switch.
 *
 * Replaces the RangePill role with correct semantics: Radix ToggleGroup in
 * single mode exposes a radio group with roving focus and arrow-key
 * navigation. Active state is a filled low-radius tile, visually distinct
 * from hover. Selection cannot be emptied: clicking the active option keeps
 * it selected.
 */

type SegmentedControlOption<T extends string> = {
  label: React.ReactNode
  value: T
  disabled?: boolean
}

type SegmentedControlProps<T extends string> = {
  options: Array<SegmentedControlOption<T>>
  value: T
  onChange: (next: T) => void
  size?: "sm" | "md"
  className?: string
  "aria-label"?: string
  "aria-labelledby"?: string
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "md",
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
      className={cn(
        "inline-flex w-fit max-w-full items-center overflow-x-auto rounded-control border border-border bg-surface-1 p-[3px] font-mono",
        size === "sm" ? "text-[10px]" : "text-[11px]",
        className
      )}
      {...aria}
    >
      {options.map(option => (
        <ToggleGroupPrimitive.Item
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          className={cn(
            "shrink-0 whitespace-nowrap rounded-tile transition-colors duration-150",
            size === "sm" ? "px-2.5 py-1" : "px-3 py-1.5",
            "text-muted-foreground hover:text-foreground",
            "data-[state=on]:bg-primary/12 data-[state=on]:text-primary",
            "outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
            "disabled:pointer-events-none disabled:opacity-40"
          )}
        >
          {option.label}
        </ToggleGroupPrimitive.Item>
      ))}
    </ToggleGroupPrimitive.Root>
  )
}

export { SegmentedControl, type SegmentedControlOption }
