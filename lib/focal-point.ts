export const CENTER_FOCAL = "50% 50%"

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
