"use client"

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react"
import { Move, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { CENTER_FOCAL, formatFocal, parseFocal } from "@/lib/focal-point"

const KEY_STEP = 2

type FramingEditorProps = {
  url: string
  /** Width divided by height of the slot the photo will fill, measured from the real container. */
  aspect: number
  initialFocal?: string
  onSave: (focal: string) => void
  onCancel: () => void
}

/**
 * Shows the photo inside a frame with the slot's exact shape (`object-fit: cover`) and lets the admin drag it to choose which
 * part stays visible. The result is a CSS `object-position`, so the live page crops identically at any size.
 */
export function FramingEditor({ url, aspect, initialFocal, onSave, onCancel }: FramingEditorProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const naturalSize = useRef({ width: 0, height: 0 })
  const drag = useRef<{ pointerX: number; pointerY: number; focal: { x: number; y: number } } | null>(null)
  const [focal, setFocal] = useState(() => parseFocal(initialFocal))
  const [dragging, setDragging] = useState(false)

  // How many pixels the photo overflows the frame by once scaled to cover it, per axis.
  function overflow() {
    const frame = frameRef.current?.getBoundingClientRect()
    const { width, height } = naturalSize.current
    if (!frame || !width || !height) return { x: 0, y: 0 }
    const scale = Math.max(frame.width / width, frame.height / height)
    return { x: Math.max(0, width * scale - frame.width), y: Math.max(0, height * scale - frame.height) }
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { pointerX: event.clientX, pointerY: event.clientY, focal }
    setDragging(true)
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return
    const { x: overflowX, y: overflowY } = overflow()
    const start = drag.current
    // Dragging the photo right reveals more of its left side, so the focal point moves the opposite way.
    setFocal({
      x: overflowX > 0.5 ? Math.min(100, Math.max(0, start.focal.x - ((event.clientX - start.pointerX) / overflowX) * 100)) : 50,
      y: overflowY > 0.5 ? Math.min(100, Math.max(0, start.focal.y - ((event.clientY - start.pointerY) / overflowY) * 100)) : 50,
    })
  }

  function endDrag() {
    drag.current = null
    setDragging(false)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [KEY_STEP, 0],
      ArrowRight: [-KEY_STEP, 0],
      ArrowUp: [0, KEY_STEP],
      ArrowDown: [0, -KEY_STEP],
    }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    setFocal((current) => ({
      x: Math.min(100, Math.max(0, current.x + move[0])),
      y: Math.min(100, Math.max(0, current.y + move[1])),
    }))
  }

  const position = formatFocal(focal)

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={frameRef}
        role="group"
        tabIndex={0}
        aria-label="Photo framing. Drag the photo, or use the arrow keys, to choose which part stays visible."
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={handleKeyDown}
        // Width is capped so a tall slot still fits on screen while keeping the exact ratio.
        style={{ aspectRatio: aspect, width: `min(100%, ${52 * aspect}vh)`, touchAction: "none" }}
        className={`relative mx-auto select-none overflow-hidden rounded-xl border border-border bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- admin-chosen URL */}
        <img
          src={url}
          alt=""
          draggable={false}
          onLoad={(event) => {
            naturalSize.current = { width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight }
          }}
          style={{ objectPosition: position }}
          className="pointer-events-none absolute inset-0 size-full object-cover"
        />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute inset-y-0 left-1/3 w-px bg-white/30" />
          <div className="absolute inset-y-0 left-2/3 w-px bg-white/30" />
          <div className="absolute inset-x-0 top-1/3 h-px bg-white/30" />
          <div className="absolute inset-x-0 top-2/3 h-px bg-white/30" />
        </div>
      </div>

      <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Move className="size-3.5" aria-hidden="true" />
        Drag the photo to keep the subject&apos;s face inside the frame.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setFocal(parseFocal(CENTER_FOCAL))}>
          <RotateCcw className="size-3.5" aria-hidden="true" />
          Center
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Back
          </Button>
          <Button type="button" onClick={() => onSave(position)}>
            Save framing
          </Button>
        </div>
      </div>
    </div>
  )
}
