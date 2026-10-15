"use client"

import { deferResizeObserver } from "@/lib/defer-resize-observer"

// Admin libraries (Radix, Puck) create observers as soon as they mount, so the patch has to be in place when the
// admin shell loads rather than when the site editor route does.
if (typeof window !== "undefined") deferResizeObserver(window)

export function ResizeObserverGuard() {
  return null
}
