import type * as React from "react"

import { cn } from "@finance-os/ui/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // base
        "h-10 w-full min-w-0 rounded-lg border bg-surface-1 px-3 py-1 text-sm shadow-xs outline-none",
        "border-border/70 text-foreground placeholder:text-muted-foreground",
        "dark:bg-input/30",
        "transition-[color,box-shadow,border-color,background] duration-150 ease-out",
        // file inputs
        "file:inline-flex file:h-8 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        // selection
        "selection:bg-primary/25 selection:text-foreground",
        // disabled
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        // focus — rose ring instead of vanilla
        "focus-visible:border-primary/50 focus-visible:ring-[3px] focus-visible:ring-primary/25",
        // invalid
        "aria-invalid:border-destructive aria-invalid:ring-destructive/25 dark:aria-invalid:ring-destructive/40",
        // tablet/desktop tighten
        "md:text-[13px]",
        className,
      )}
      {...props}
    />
  )
}

export { Input }
