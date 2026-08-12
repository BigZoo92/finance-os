"use client"

import type * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "@finance-os/ui/lib/utils"

/**
 * Drawer — canonical Command Pixel sheet, built on Radix Dialog.
 *
 * Bottom is the mobile pattern (mobile More navigation, contextual mobile
 * actions); `side="right"` exists for wide drilldowns. Inherits the Dialog
 * a11y contract: focus trap, focus restoration, Escape, scroll lock,
 * `aria-labelledby` via DrawerTitle. No drag physics by design.
 */

type DrawerSide = "bottom" | "right"

function Drawer({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="drawer" {...props} />
}

function DrawerTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="drawer-trigger" {...props} />
}

function DrawerClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="drawer-close" {...props} />
}

const SIDE_CLASSES: Record<DrawerSide, string> = {
  bottom: [
    "inset-x-0 bottom-0 max-h-[85dvh] w-full rounded-t-frame border-t",
    "pb-[max(1.25rem,env(safe-area-inset-bottom))]",
    "data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
  ].join(" "),
  right: [
    "inset-y-0 right-0 h-full w-[min(420px,calc(100vw-2rem))] border-l",
    "data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
  ].join(" "),
}

function DrawerContent({
  className,
  children,
  side = "bottom",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { side?: DrawerSide }) {
  return (
    <DialogPrimitive.Portal data-slot="drawer-portal">
      <DialogPrimitive.Overlay
        data-slot="drawer-overlay"
        className={cn(
          "fixed inset-0 z-[var(--z-drawer)] bg-black/55",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          "duration-150"
        )}
      />
      <DialogPrimitive.Content
        data-slot="drawer-content"
        className={cn(
          "fixed z-[var(--z-drawer)] flex flex-col overflow-y-auto border-border bg-card text-card-foreground shadow-overlay outline-hidden",
          "data-[state=open]:animate-in data-[state=closed]:animate-out duration-200",
          SIDE_CLASSES[side],
          className
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn("flex flex-col gap-1 px-5 pt-5 pb-3", className)}
      {...props}
    />
  )
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn("mt-auto flex flex-col gap-2 px-5 pb-5", className)}
      {...props}
    />
  )
}

function DrawerTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="drawer-title"
      className={cn("text-base font-semibold tracking-tight text-foreground", className)}
      {...props}
    />
  )
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="drawer-description"
      className={cn("text-[13px] text-muted-foreground", className)}
      {...props}
    />
  )
}

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
