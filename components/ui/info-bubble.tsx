"use client"

import { useEffect, useId, useRef, useState } from "react"
import { Info } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Small "(i)" icon that reveals a short explanation.
 * Works with hover on desktop and tap on mobile (no hover-only Radix
 * dependency), and dismisses on outside click / Escape / re-tap.
 */
export function InfoBubble({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }

    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open])

  return (
    <span ref={ref} className={cn("relative inline-flex", className)}>
      <button
        type="button"
        aria-describedby={open ? id : undefined}
        aria-label="More information"
        onClick={(event) => {
          event.stopPropagation()
          setOpen((value) => !value)
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:text-[#e829f1] focus-visible:text-[#e829f1] focus-visible:outline-none"
      >
        <Info className="size-3.5" />
      </button>
      {open ? (
        <span
          id={id}
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-2 w-56 -translate-x-1/2 rounded-xl border border-zinc-800 bg-[#18181b] px-3 py-2 text-xs font-normal leading-relaxed text-zinc-300 shadow-xl"
        >
          {children}
          <span className="absolute left-1/2 top-full -mt-px size-2 -translate-x-1/2 rotate-45 border-b border-r border-zinc-800 bg-[#18181b]" />
        </span>
      ) : null}
    </span>
  )
}
