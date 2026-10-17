"use client"

import { deferResizeObserver } from "@/lib/defer-resize-observer"

const RESIZE_OBSERVER_MESSAGES = [
  "ResizeObserver loop completed with undelivered notifications.",
  "ResizeObserver loop limit exceeded",
]

// The patch must be in place before any library creates an observer, so it runs when this module loads rather than
// in an effect. It is mounted from the root layout so every route (public pages, admin, the editor) is covered.
if (typeof window !== "undefined") {
  deferResizeObserver(window)

  // Observers created before the patch (for example by the framework's own overlay) can still report this browser
  // notice, which only means a resize was delivered a frame late; keep it away from the error overlay.
  window.addEventListener(
    "error",
    (event) => {
      if (RESIZE_OBSERVER_MESSAGES.includes(event.message)) event.stopImmediatePropagation()
    },
    true
  )
}

export function ResizeObserverGuard() {
  return null
}
