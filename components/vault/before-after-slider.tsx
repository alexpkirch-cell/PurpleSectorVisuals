"use client"

import { useCallback, useRef, useState } from "react"
import { MoveHorizontal } from "lucide-react"

export function BeforeAfterSlider({
  beforeUrl,
  afterUrl,
  fileName,
}: {
  beforeUrl: string
  afterUrl: string
  fileName: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState(50)
  const draggingRef = useRef(false)

  const updateFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const ratio = ((clientX - rect.left) / rect.width) * 100
    setPosition(Math.min(100, Math.max(0, ratio)))
  }, [])

  function startDrag(clientX: number) {
    draggingRef.current = true
    updateFromClientX(clientX)
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!draggingRef.current) return
    updateFromClientX(event.clientX)
  }

  function stopDrag() {
    draggingRef.current = false
  }

  return (
    <div
      ref={containerRef}
      className="group relative touch-none select-none overflow-hidden rounded-lg border border-border bg-muted"
      onPointerDown={(e) => {
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        startDrag(e.clientX)
      }}
      onPointerMove={onPointerMove}
      onPointerUp={stopDrag}
      onPointerLeave={stopDrag}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- signed URLs are short-lived and not worth Next Image optimization */}
      <img
        src={afterUrl}
        alt={`${fileName} — after`}
        className="pointer-events-none size-full object-cover"
        crossOrigin="anonymous"
      />
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- signed URLs are short-lived and not worth Next Image optimization */}
        <img
          src={beforeUrl}
          alt={`${fileName} — before`}
          className="size-full object-cover"
          crossOrigin="anonymous"
        />
      </div>

      <span className="absolute top-1.5 left-1.5 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
        Before/After
      </span>

      <div
        className="pointer-events-none absolute inset-y-0 w-0.5 bg-background"
        style={{ left: `${position}%` }}
      >
        <span className="absolute top-1/2 left-1/2 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-background text-foreground shadow-md">
          <MoveHorizontal className="size-4" />
        </span>
      </div>

      <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-background/80 to-transparent px-2 py-1.5 text-xs text-foreground">
        {fileName}
      </span>
    </div>
  )
}
