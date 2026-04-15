import type * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@finance-os/ui/lib/utils"

const badgeVariants = cva(
  [
    "inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium w-fit whitespace-nowrap shrink-0",
    "tracking-wide [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none",
    "focus-visible:ring-2 focus-visible:ring-ring/50 transition-colors duration-150 overflow-hidden",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-primary/12 text-primary border-primary/25 [a&]:hover:bg-primary/20",
        secondary:
          "bg-secondary text-secondary-foreground border-border/50 [a&]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/12 text-destructive border-destructive/25 [a&]:hover:bg-destructive/20",
        outline:
          "border-border text-muted-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        ghost:
          "border-transparent text-muted-foreground [a&]:hover:bg-accent [a&]:hover:text-foreground",
        link: "border-transparent text-primary underline-offset-4 [a&]:hover:underline",
        positive:
          "bg-positive/12 text-positive border-positive/25",
        warning:
          "bg-warning/14 text-warning border-warning/28",
        violet:
          "bg-accent-2/12 text-accent-2 border-accent-2/25",
        solid:
          "bg-primary text-primary-foreground border-transparent shadow-[0_0_0_1px_oklch(from_var(--primary)_l_c_h/30%),0_6px_14px_-6px_oklch(from_var(--primary)_l_c_h/40%)]",
        glass:
          "glass-surface text-foreground border-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
