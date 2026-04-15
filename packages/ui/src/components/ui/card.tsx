import type * as React from "react"

import { cn } from "@finance-os/ui/lib/utils"

/**
 * Card — primary surface container.
 *
 * In the Aurora Pink direction, the default card is quiet: subtle border,
 * a 1-step elevation ambient, and a whisper of warm tint. Visual intensity
 * is opt-in through variants (`tone="brand"` for rose-accented surfaces,
 * `tone="violet"` for the secondary accent). Keep data-dense cards `tone="plain"`.
 */
function Card({
  className,
  tone = "plain",
  ...props
}: React.ComponentProps<"div"> & {
  tone?: "plain" | "brand" | "violet" | "elevated"
}) {
  return (
    <div
      data-slot="card"
      data-tone={tone}
      className={cn(
        // base surface
        "relative flex flex-col gap-6 rounded-2xl border py-6 transition-all duration-200 ease-out",
        "bg-card text-card-foreground border-border/60",
        "shadow-[0_1px_2px_oklch(0_0_0/4%),0_6px_20px_-8px_oklch(0_0_0/6%)]",
        "hover:shadow-[0_2px_4px_oklch(0_0_0/5%),0_16px_40px_-14px_oklch(0_0_0/10%)]",
        // tone variants
        tone === "brand" &&
          "border-primary/18 bg-[linear-gradient(180deg,oklch(from_var(--primary)_l_c_h/6%),transparent_55%),var(--card)] hover:border-primary/28",
        tone === "violet" &&
          "border-accent-2/18 bg-[linear-gradient(180deg,oklch(from_var(--accent-2)_l_c_h/6%),transparent_55%),var(--card)] hover:border-accent-2/28",
        tone === "elevated" &&
          "bg-surface-2 border-border/40 shadow-[0_2px_6px_oklch(0_0_0/5%),0_22px_50px_-16px_oklch(0_0_0/14%)]",
        className,
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className,
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("leading-none font-semibold tracking-tight", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-muted-foreground text-sm leading-relaxed", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("px-6", className)} {...props} />
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
