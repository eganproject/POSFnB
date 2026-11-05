"use client";
import * as React from "react";
import { Drawer as V } from "vaul";
import { cn } from "@/lib/utils";

export const Drawer = V.Root;
export const DrawerTrigger = V.Trigger;
export const DrawerClose = V.Close;
export const DrawerTitle = V.Title;
export const DrawerDescription = V.Description;

/** Bottom sheet ala aplikasi mobile */
export function DrawerContent({ className, children, ...props }: React.ComponentProps<typeof V.Content>) {
  return (
    <V.Portal>
      <V.Overlay className="fixed inset-0 z-50 bg-black/45" />
      <V.Content
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] max-w-xl flex-col rounded-t-[1.75rem] bg-card outline-none",
          className
        )}
        {...props}
      >
        <div className="mx-auto mt-2.5 h-1.5 w-12 shrink-0 rounded-full bg-muted-foreground/25" />
        {children}
      </V.Content>
    </V.Portal>
  );
}
