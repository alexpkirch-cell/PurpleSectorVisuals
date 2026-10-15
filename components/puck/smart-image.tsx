import Image from "next/image"

import { cn } from "@/lib/utils"

export type ImageSizing = "auto" | "square" | "portrait" | "vertical" | "landscape" | "custom"
export type ImageObjectFit = "cover" | "contain"

export const DEFAULT_CUSTOM_HEIGHT = 480

const ratioClass: Record<Exclude<ImageSizing, "auto" | "custom">, string> = {
  square: "aspect-square",
  portrait: "aspect-[4/5]",
  vertical: "aspect-[9/16]",
  landscape: "aspect-video",
}

const legacyAspectToSizing = {
  video: "landscape",
  square: "square",
  portrait: "portrait",
} as const

/** Maps older saved `aspect` values onto the new `sizing` field so existing pages keep their look. */
export function resolveImageSizing(sizing: ImageSizing | undefined, legacyAspect?: keyof typeof legacyAspectToSizing) {
  if (sizing) return sizing
  return (legacyAspect && legacyAspectToSizing[legacyAspect]) || "landscape"
}

/** Only local files and our Supabase public bucket are allowed by next.config; anything else (pasted URLs, HEIC) skips the optimizer. */
function needsUnoptimized(src: string) {
  if (/\.heic(\?.*)?$/i.test(src)) return true
  if (src.startsWith("/")) return false
  try {
    const url = new URL(src)
    return !(url.protocol === "https:" && url.hostname.endsWith(".supabase.co"))
  } catch {
    return true
  }
}

type SmartImageProps = {
  src: string
  alt: string
  sizing: ImageSizing
  objectFit?: ImageObjectFit
  customHeight?: number
  emptyLabel?: string
  className?: string
}

export function SmartImage({
  src,
  alt,
  sizing,
  objectFit = "cover",
  customHeight = DEFAULT_CUSTOM_HEIGHT,
  emptyLabel,
  className,
}: SmartImageProps) {
  const frame = "w-full overflow-hidden rounded-3xl border border-zinc-800 shadow-2xl shadow-black/60"
  const isVertical = sizing === "vertical"
  // A 9:16 frame at full column width would be ~2000px tall, so cap its width and center it.
  const outer = isVertical ? "mx-auto w-full max-w-md" : "w-full"

  if (!src) {
    return (
      <div className={outer}>
        <div
          className={cn(
            frame,
            "flex items-center justify-center border-dashed border-zinc-700 bg-zinc-900/60 px-6 text-center text-sm text-zinc-400",
            sizing === "auto" || sizing === "custom" ? "min-h-64" : ratioClass[sizing],
            className
          )}
          style={sizing === "custom" ? { height: customHeight } : undefined}
        >
          {emptyLabel}
        </div>
      </div>
    )
  }

  if (sizing === "auto") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} className={cn(frame, "h-auto", className)} />
    )
  }

  return (
    <div className={outer}>
      <div
        className={cn(
          "relative",
          frame,
          objectFit === "contain" && "bg-zinc-900",
          sizing !== "custom" && ratioClass[sizing],
          className
        )}
        style={sizing === "custom" ? { height: customHeight } : undefined}
      >
        <Image
          src={src}
          alt={alt}
          fill
          sizes={isVertical ? "(max-width: 448px) 100vw, 448px" : "(max-width: 1152px) 100vw, 1152px"}
          unoptimized={needsUnoptimized(src)}
          className={objectFit === "contain" ? "object-contain" : "object-cover"}
        />
      </div>
    </div>
  )
}
