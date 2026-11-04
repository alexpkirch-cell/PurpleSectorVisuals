import type { CSSProperties } from "react"

export const CENTER_FOCAL = "50% 50%"
export const MIN_ZOOM = 1
export const MAX_ZOOM = 3

/** How the admin framed a photo inside its slot. The source file is never touched; this only changes how it is displayed. */
export type PhotoFrame = { focal?: string; zoom?: number }

const clamp = (value: number) => Math.min(100, Math.max(0, value))

/** Reads a CSS `object-position` made of two percentages, e.g. "42.5% 18%". Anything else falls back to the center. */
export function parseFocal(focal?: string | null): { x: number; y: number } {
  const match = focal?.match(/^\s*(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%\s*$/)
  if (!match) return { x: 50, y: 50 }
  return { x: clamp(Number(match[1])), y: clamp(Number(match[2])) }
}

export function formatFocal({ x, y }: { x: number; y: number }) {
  return `${Math.round(clamp(x) * 10) / 10}% ${Math.round(clamp(y) * 10) / 10}%`
}

export function clampZoom(zoom?: number | null) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number.isFinite(zoom) ? Number(zoom) : MIN_ZOOM))
}

/**
 * The inline style that reproduces a framing on an `object-fit: cover` image inside an `overflow: hidden` slot.
 * `object-position` picks the part of the photo that stays visible; zoom scales the photo around that same point, so the
 * point under the focal position never moves and the photo always keeps covering the slot.
 */
export function frameStyle(frame?: PhotoFrame): CSSProperties {
  const position = frame?.focal || CENTER_FOCAL
  const zoom = clampZoom(frame?.zoom)
  return {
    objectPosition: position,
    ...(zoom > MIN_ZOOM ? { transform: `scale(${zoom})`, transformOrigin: position } : {}),
  }
}
