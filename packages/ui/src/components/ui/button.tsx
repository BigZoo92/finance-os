import type * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@finance-os/ui/lib/utils"

const buttonVariants = cva(
  // base — relative for shine overlay, slight scale-on-press, premium focus ring
  [
    "group/btn relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium select-none cursor-pointer",
    "transition-[transform,box-shadow,background,color,border-color] duration-150 ease-out",
    "disabled:pointer-events-none disabled:opacity-40",
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0",
    "outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "active:scale-[0.97]",
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          // rose signature with subtle brand shadow + inner highlight
          "bg-primary text-primary-foreground",
          "shadow-[0_1px_2px_oklch(0_0_0/18%),inset_0_1px_0_oklch(1_0_0/18%)]",
          "hover:shadow-[0_6px_18px_-4px_oklch(from_var(--primary)_l_c_h/45%),inset_0_1px_0_oklch(1_0_0/22%)]",
          "hover:brightness-[1.06]",
        ].join(" "),
        aurora: [
          // brand hero CTA — aurora gradient with soft glow
          "text-primary-foreground",
          "bg-[linear-gradient(92deg,var(--aurora-a)_0%,var(--aurora-b)_50%,var(--aurora-c)_100%)]",
          "shadow-[0_10px_30px_-8px_oklch(from_var(--primary)_l_c_h/45%),inset_0_1px_0_oklch(1_0_0/25%)]",
          "bg-[length:200%_100%] bg-[position:0%_50%]",
          "hover:bg-[position:100%_50%]",
          "transition-[background-position,box-shadow,transform] duration-500",
        ].join(" "),
        destructive:
          "bg-destructive text-white shadow-[0_1px_2px_oklch(0_0_0/16%)] hover:brightness-[1.06] focus-visible:ring-destructive/50",
        outline:
          "border border-border bg-transparent shadow-xs hover:bg-accent/60 hover:border-primary/30 hover:text-primary hover:shadow-sm",
        soft:
          // subtle brand-tinted surface — for secondary CTAs that should still feel on-brand
          "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 hover:border-primary/30",
        secondary:
          "bg-secondary text-secondary-foreground border border-border/40 hover:bg-secondary/70 hover:shadow-xs",
        ghost:
          "hover:bg-accent/50 hover:text-foreground text-muted-foreground",
        link:
          "text-primary underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5 text-xs",
        lg: "h-11 rounded-xl px-6 has-[>svg]:px-4 text-[15px]",
        xl: "h-12 rounded-xl px-7 has-[>svg]:px-5 text-[15px] font-semibold",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
