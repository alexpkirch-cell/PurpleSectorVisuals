import { Camera } from "lucide-react"

import { cn } from "@/lib/utils"

interface ImageSlotProps {
  aspect?: string
  label?: string
  glow?: boolean
  compact?: boolean
  className?: string
}

export function ImageSlot({
  aspect = "16:9 Slot",
  label = "Drop Asset Here",
  glow = false,
  compact = false,
  className,
}: ImageSlotProps) {
  return (
    <div
      className={cn(
        "relative flex size-full flex-col items-center justify-center border border-dashed border-zinc-800 bg-[#121214]",
        compact ? "gap-1.5" : "gap-3",
        glow &&
          "transition-all duration-500 ease-out hover:border-[#e829f1] hover:shadow-[0_0_24px_rgba(232,41,241,0.22)]",
        className
      )}
    >
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(#e4e4e7 1px, transparent 1px), linear-gradient(90deg, #e4e4e7 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <Camera
        className={cn(
          "relative z-10 text-zinc-600",
          compact ? "size-3.5" : "size-6"
        )}
        strokeWidth={1.5}
      />
      <div className="relative z-10 flex flex-col items-center gap-1.5 px-2 text-center">
        {aspect ? (
          <span className="rounded-full border border-zinc-800 bg-zinc-900/80 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            {aspect}
          </span>
        ) : null}
        <span
          className={cn(
            "text-zinc-600",
            compact ? "text-[10px] leading-tight" : "text-xs"
          )}
        >
          {label}
        </span>
      </div>
    </div>
  )
}
