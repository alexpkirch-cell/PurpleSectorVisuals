const PATCHED = Symbol.for("psv.deferredResizeObserver")

type PatchableWindow = Window & typeof globalThis & { [PATCHED]?: boolean }

// Two things trigger the browser's "ResizeObserver loop completed with undelivered notifications" error in the Puck
// editor, and this patch removes both at the source instead of hiding the error:
//
// 1. A callback that changes layout inside the same frame. Callbacks run in the next animation frame instead.
// 2. An observer created in this window watching elements inside the canvas iframe. Chrome reports the loop error for
//    such cross-document observations even when the callback does nothing, so elements that belong to another window
//    are watched by an observer from that window's own ResizeObserver.
export function deferResizeObserver(target: Window | null | undefined) {
  const maybeWindow = target as PatchableWindow | null | undefined
  if (!maybeWindow || maybeWindow[PATCHED] || typeof maybeWindow.ResizeObserver === "undefined") return
  const win: PatchableWindow = maybeWindow
  win[PATCHED] = true

  const NativeResizeObserver = win.ResizeObserver

  class DeferredResizeObserver extends NativeResizeObserver {
    private readonly deliver: (entries: ResizeObserverEntry[]) => void
    private readonly foreignObservers = new Map<Window, ResizeObserver>()

    constructor(callback: ResizeObserverCallback) {
      let frame = 0
      let pending: ResizeObserverEntry[] = []
      let self: ResizeObserver | undefined

      const deliver = (entries: ResizeObserverEntry[]) => {
        pending = pending.concat(entries)
        if (frame) return
        frame = win.requestAnimationFrame(() => {
          frame = 0
          const batch = pending
          pending = []
          callback(batch, self as ResizeObserver)
        })
      }

      super(deliver)
      self = this
      this.deliver = deliver
    }

    observe(target: Element, options?: ResizeObserverOptions) {
      const view = target.ownerDocument?.defaultView
      if (view && view !== win && typeof view.ResizeObserver !== "undefined") {
        let observer = this.foreignObservers.get(view)
        if (!observer) {
          observer = new view.ResizeObserver((entries) => this.deliver(entries))
          this.foreignObservers.set(view, observer)
        }
        observer.observe(target, options)
        return
      }
      super.observe(target, options)
    }

    unobserve(target: Element) {
      this.foreignObservers.forEach((observer) => observer.unobserve(target))
      super.unobserve(target)
    }

    disconnect() {
      this.foreignObservers.forEach((observer) => observer.disconnect())
      this.foreignObservers.clear()
      super.disconnect()
    }
  }

  win.ResizeObserver = DeferredResizeObserver
}
