import { isVideoUrl } from "@/lib/team-directory"
import { cn } from "@/lib/utils"

type TileKind = "big" | "tall" | "square" | "wide" | "half" | "full"

// The grid has 2 columns on phones and 4 from `md` up. Every kind only widens or heightens a tile, so `grid-flow-dense`
// can tuck the small ones in beside the large ones.
const TILE_CLASS: Record<TileKind, string> = {
  big: "col-span-2 row-span-2",
  tall: "row-span-2",
  square: "",
  wide: "col-span-2",
  half: "col-span-2 row-span-2",
  full: "col-span-2 md:col-span-4",
}

// Each block is a whole number of rows on the 4-column grid, so a full block never leaves a hole.
const BLOCK_A: TileKind[] = ["big", "tall", "square", "square"]
const BLOCK_B: TileKind[] = ["wide", "square", "square", "square", "square", "wide"]

// Closing arrangements for 1 to 5 leftover photos, also whole rows.
const TAILS: Record<number, TileKind[]> = {
  1: ["full"],
  2: ["half", "half"],
  3: ["big", "tall", "tall"],
  4: ["wide", "square", "square", "full"],
  5: ["wide", "square", "square", "wide", "wide"],
}

function tileKinds(count: number): TileKind[] {
  const kinds: TileKind[] = []
  while (count - kinds.length >= BLOCK_A.length + BLOCK_B.length) kinds.push(...BLOCK_A, ...BLOCK_B)

  let rest = count - kinds.length
  if (rest >= BLOCK_A.length) {
    kinds.push(...BLOCK_A)
    rest -= BLOCK_A.length
  }
  if (rest > 0) kinds.push(...TAILS[rest])
  return kinds
}

/** Mixed squares, wide shots and tall portraits that all fill their tile edge to edge, whatever the upload's proportions. */
export function HighlightBento({ name, media }: { name: string; media: string[] }) {
  const kinds = tileKinds(media.length)

  return (
    <ul className="grid auto-rows-[9rem] grid-flow-dense grid-cols-2 gap-3 sm:auto-rows-[11rem] sm:gap-4 md:auto-rows-[13rem] md:grid-cols-4 lg:auto-rows-[15rem]">
      {media.map((url, index) => (
        <li key={`${url}-${index}`} className={cn("relative overflow-hidden rounded-xl bg-muted", TILE_CLASS[kinds[index]])}>
          {isVideoUrl(url) ? (
            <video
              src={url}
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              aria-label={`${name} highlight video ${index + 1}`}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={`${name} highlight ${index + 1}`}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
        </li>
      ))}
    </ul>
  )
}
