"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Eraser } from "lucide-react"

import { Button } from "@/components/ui/button"

const CANVAS_HEIGHT = 140

interface SignaturePadProps {
  onChange: (dataUrl: string | null) => void
}

export function SignaturePad({ onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const [hasInk, setHasInk] = useState(false)

  const prepareContext = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const ctx = canvas.getContext("2d")
    if (!ctx) return null
    ctx.lineWidth = 2.25
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.strokeStyle = "#111111"
    return ctx
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ratio = window.devicePixelRatio || 1
    const width = canvas.clientWidth
    canvas.width = width * ratio
    canvas.height = CANVAS_HEIGHT * ratio
    canvas.getContext("2d")?.scale(ratio, ratio)
  }, [])

  function pointFrom(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = prepareContext()
    if (!ctx) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drawingRef.current = true
    const { x, y } = pointFrom(event)
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + 0.01, y + 0.01)
    ctx.stroke()
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    const ctx = prepareContext()
    if (!ctx) return
    const { x, y } = pointFrom(event)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  function handlePointerEnd() {
    if (!drawingRef.current) return
    drawingRef.current = false
    const canvas = canvasRef.current
    if (!canvas) return
    setHasInk(true)
    onChange(canvas.toDataURL("image/png"))
  }

  function handleClear() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.restore()
    setHasInk(false)
    onChange(null)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative overflow-hidden rounded-xl border border-border bg-white">
        <canvas
          ref={canvasRef}
          aria-label="Signature pad. Draw your signature with a finger, stylus or mouse."
          className="block w-full touch-none cursor-crosshair"
          style={{ height: CANVAS_HEIGHT }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
        />
        {!hasInk && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-neutral-400">
            Sign here
          </span>
        )}
      </div>
      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={handleClear} disabled={!hasInk}>
          <Eraser className="h-4 w-4" />
          Clear
        </Button>
      </div>
    </div>
  )
}
