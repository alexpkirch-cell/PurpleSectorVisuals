/** Every roster cutout is saved at this shape (width / height), so the public profile and team cards can rely on it. */
export const CUTOUT_ASPECT = 3 / 4

const MAX_OUTPUT_HEIGHT = 2400
const MAX_PNG_BYTES = 6 * 1024 * 1024

export type PixelCrop = { x: number; y: number; width: number; height: number }

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    // Object URLs and same-origin files ignore this; it keeps canvas export legal for public storage URLs.
    image.crossOrigin = "anonymous"
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("The image could not be read. Try a different file."))
    image.src = src
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/**
 * Cuts `area` (in the photo's own pixels) out of `src` and returns it as a new file of exactly `aspect`.
 * PNG keeps transparent cutouts intact; a very heavy result falls back to WebP, which also keeps transparency.
 */
export async function cropImageToFile(src: string, area: PixelCrop, aspect: number, sourceName: string): Promise<File> {
  const image = await loadImage(src)

  const scale = Math.min(1, MAX_OUTPUT_HEIGHT / area.height)
  const height = Math.max(1, Math.round(area.height * scale))
  const width = Math.max(1, Math.round(height * aspect))

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d")
  if (!context) throw new Error("Cropping is not supported in this browser.")
  context.imageSmoothingQuality = "high"
  context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, width, height)

  let blob = await canvasToBlob(canvas, "image/png")
  if (blob && blob.size > MAX_PNG_BYTES) blob = (await canvasToBlob(canvas, "image/webp", 0.92)) ?? blob
  if (!blob) throw new Error("The cropped image could not be created.")

  const extension = blob.type === "image/webp" ? "webp" : "png"
  const baseName = sourceName.replace(/\.[^.]+$/, "").replace(/[^a-z0-9-_]+/gi, "-").slice(0, 60) || "cutout"
  return new File([blob], `${baseName}-cropped.${extension}`, { type: blob.type })
}
