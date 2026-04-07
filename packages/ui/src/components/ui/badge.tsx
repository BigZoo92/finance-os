import type * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@finance-os/ui/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-md border border-transparent px-2.5 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:ring-2 focus-visible:ring-ring/50 transition-all duration-150 overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-primary/15 text-primary border-primary/20 [a&]:hover:bg-primary/25",
        secondary:
          "bg-secondary text-secondary-foreground border-border/40 [a&]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/15 text-destructive border-destructive/20 [a&]:hover:bg-destructive/25",
        outline:
          "border-border text-muted-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        ghost: "text-muted-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        link: "text-primary underline-offset-4 [a&]:hover:underline",
        positive: "bg-positive/15 text-positive border-positive/20",
        warning: "bg-warning/15 text-warning border-warning/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
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
