"use client"

import { useState } from "react"
import { Camera } from "lucide-react"

import { cn } from "@/lib/utils"

interface VideoSlotProps {
  /** Public path to the hero video. Swap this file in /public to go live. */
  src?: string
  poster?: string
  label?: string
  className?: string
}

/**
 * Full-bleed background video placeholder. Renders the real <video> when the
 * source file exists; falls back to a dashed placeholder (matching ImageSlot)
 * once the browser reports the file is missing, so the slot stays obviously
 * swappable pre-launch without breaking the layout.
 */
export function VideoSlot({
  src = "/videos/hero-reel.mp4",
  poster,
  label = "Full-bleed Hero Video Slot",
  className,
}: VideoSlotProps) {
  const [missing, setMissing] = useState(false)

  if (missing) {
    return (
      <div
        className={cn(
          "absolute inset-0 flex flex-col items-center justify-center gap-3 border border-dashed border-zinc-800 bg-[#0c0c0e]",
          className
        )}
      >
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(#e4e4e7 1px, transparent 1px), linear-gradient(90deg, #e4e4e7 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <Camera className="relative z-10 size-8 text-zinc-700" strokeWidth={1.5} />
        <div className="relative z-10 flex flex-col items-center gap-1.5 text-center">
          <span className="rounded-full border border-zinc-800 bg-zinc-900/80 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            16:9 Background Video Slot
          </span>
          <span className="text-xs text-zinc-600">{label}</span>
          <span className="text-[10px] text-zinc-700">Replace {src} to go live</span>
        </div>
      </div>
    )
  }

  return (
    <video
      className={cn("absolute inset-0 size-full object-cover", className)}
      autoPlay
      muted
      loop
      playsInline
      poster={poster}
      onError={() => setMissing(true)}
    >
      <source src={src} type="video/mp4" />
    </video>
  )
}
