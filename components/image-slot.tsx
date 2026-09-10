import { Camera } from "lucide-react"

import { cn } from "@/lib/utils"

interface ImageSlotProps {
  aspect?: string
  label?: string
  glow?: boolean
  className?: string
}

export function ImageSlot({
  aspect = "16:9 Slot",
  label = "Drop Asset Here",
  glow = false,
  className,
}: ImageSlotProps) {
  return (
    <div
      className={cn(
        "relative flex size-full flex-col items-center justify-center gap-3 border border-dashed border-zinc-800 bg-[#121214]",
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
      <Camera className="relative z-10 size-6 text-zinc-600" strokeWidth={1.5} />
      <div className="relative z-10 flex flex-col items-center gap-1.5">
        <span className="rounded-full border border-zinc-800 bg-zinc-900/80 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
          {aspect}
        </span>
        <span className="text-xs text-zinc-600">{label}</span>
      </div>
    </div>
  )
}
