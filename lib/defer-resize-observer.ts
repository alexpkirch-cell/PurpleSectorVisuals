const PATCHED = Symbol.for("psv.deferredResizeObserver")

type PatchableWindow = Window & typeof globalThis & { [PATCHED]?: boolean }

// A ResizeObserver callback that changes layout inside the same frame triggers the browser's "loop completed with
// undelivered notifications" error. Running callbacks in the next animation frame breaks that loop at the source.
export function deferResizeObserver(target: Window | null | undefined) {
  const maybeWindow = target as PatchableWindow | null | undefined
  if (!maybeWindow || maybeWindow[PATCHED] || typeof maybeWindow.ResizeObserver === "undefined") return
  const win: PatchableWindow = maybeWindow
  win[PATCHED] = true

  const NativeResizeObserver = win.ResizeObserver

  class DeferredResizeObserver extends NativeResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      let frame = 0
      let pending: ResizeObserverEntry[] = []
      super((entries, observer) => {
        pending = pending.concat(entries)
        if (frame) return
        frame = win.requestAnimationFrame(() => {
          frame = 0
          const batch = pending
          pending = []
          callback(batch, observer)
        })
      })
    }
  }

  win.ResizeObserver = DeferredResizeObserver
}
