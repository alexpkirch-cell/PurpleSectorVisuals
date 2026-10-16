"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"

import { PhotoLightbox, type LightboxImage } from "@/components/photo-lightbox"

const MIN_RENDERED_WIDTH = 120

/** Optimized next/image URLs wrap the original file in a `url` query param; open the original instead. */
function originalSrc(src: string) {
  try {
    const url = new URL(src, window.location.href)
    if (url.pathname === "/_next/image") return url.searchParams.get("url") ?? src
  } catch {
    // Not a parseable URL; use it as-is.
  }
  return src
}

/**
 * Opens any plain site image in the lightbox when clicked. Images already inside a link, button or another
 * lightbox trigger keep their own behavior, and the admin area is left alone.
 */
export function GlobalLightbox() {
  const pathname = usePathname()
  const [image, setImage] = useState<LightboxImage | null>(null)
  const disabled = pathname.startsWith("/admin")

  useEffect(() => {
    if (disabled) return

    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return
      const target = event.target
      if (!(target instanceof HTMLImageElement)) return
      if (target.closest("a, button, [role='button'], [role='dialog'], [data-no-lightbox]")) return
      if (target.getBoundingClientRect().width < MIN_RENDERED_WIDTH) return

      const src = originalSrc(target.currentSrc || target.src)
      if (!src) return

      setImage({
        src,
        title: target.dataset.title || target.alt || undefined,
        category: target.dataset.category,
        shooter: target.dataset.shooter ?? null,
        camera: target.dataset.camera ?? null,
        lens: target.dataset.lens ?? null,
        settings: target.dataset.settings ?? null,
      })
    }

    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [disabled])

  if (!image || disabled) return null
  return <PhotoLightbox images={[image]} index={0} onClose={() => setImage(null)} />
}
