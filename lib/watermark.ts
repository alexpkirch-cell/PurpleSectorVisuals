import "server-only"

import sharp from "sharp"

const PREVIEW_MAX_EDGE = 1280
const PREVIEW_QUALITY = 68

/**
 * A PSV monogram drawn from strokes instead of text, so it renders the same on serverless hosts that ship no system
 * fonts. Each pass is drawn twice (dark underlay, light overlay) to stay readable on both bright and dark photos.
 */
const MONOGRAM_PATHS = [
  "M0 44 L0 0 L18 0 Q28 0 28 11 Q28 22 18 22 L0 22",
  "M66 6 Q66 0 56 0 L48 0 Q38 0 38 10 Q38 20 48 22 L56 22 Q66 24 66 34 Q66 44 56 44 L48 44 Q38 44 38 38",
  "M76 0 L90 44 L104 0",
]

function watermarkSvg(width: number, height: number) {
  const paths = MONOGRAM_PATHS.map((d) => `<path d="${d}"/>`).join("")
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <pattern id="tile" width="230" height="150" patternUnits="userSpaceOnUse" patternTransform="rotate(-28)">
      <g transform="translate(40 50)" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <g stroke="#000" stroke-opacity="0.35" stroke-width="9">${paths}</g>
        <g stroke="#fff" stroke-opacity="0.7" stroke-width="5">${paths}</g>
      </g>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#tile)"/>
</svg>`)
}

/** Downsizes an image and tiles the monogram across it. The result is never the full-resolution original. */
export async function createWatermarkedPreview(source: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(source)
    .rotate()
    .resize({ width: PREVIEW_MAX_EDGE, height: PREVIEW_MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .toBuffer({ resolveWithObject: true })

  return sharp(data)
    .composite([{ input: watermarkSvg(info.width, info.height), top: 0, left: 0 }])
    .jpeg({ quality: PREVIEW_QUALITY, mozjpeg: true })
    .toBuffer()
}
