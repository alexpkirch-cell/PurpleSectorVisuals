const DAY_MS = 86_400_000

/** A photo this many days old is half as likely to rise to the top as one uploaded today. */
export const RECENCY_HALF_LIFE_DAYS = 90

/** Keeps very old (or undated) photos in the draw so the bottom of the gallery still rotates. */
export const MIN_RECENCY_WEIGHT = 0.08

type DateLike = Date | string | number | null | undefined

export type GallerySortOptions<T> = {
  isFeatured: (item: T) => boolean
  getDate: (item: T) => DateLike
  now?: number
  random?: () => number
  halfLifeDays?: number
  minWeight?: number
}

/** Sampling weight in (0, 1 + minWeight]: 1 for a photo uploaded now, halving every `halfLifeDays`, never below `minWeight`. */
export function recencyWeight(date: DateLike, now: number, halfLifeDays: number, minWeight: number): number {
  const time = date == null ? Number.NaN : new Date(date).getTime()
  const ageDays = Number.isFinite(time) ? Math.max(0, now - time) / DAY_MS : Number.POSITIVE_INFINITY
  return minWeight + 0.5 ** (ageDays / halfLifeDays)
}

function shuffleInPlace<T>(list: T[], random: () => number) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
}

/**
 * Orders a gallery for one page load.
 *
 * 1. Starred items come first, in a fresh random order.
 * 2. Everything else follows in a weighted random order: each photo draws a random key scaled by its recency weight
 *    (Efraimidis-Spirakis sampling), so newer photos usually sit higher but older ones can still surface.
 *
 * One pass to key every item plus one sort, so it is O(n log n) and does no per-item I/O.
 */
export function sortGallery<T>(items: readonly T[], options: GallerySortOptions<T>): T[] {
  const {
    isFeatured,
    getDate,
    now = Date.now(),
    random = Math.random,
    halfLifeDays = RECENCY_HALF_LIFE_DAYS,
    minWeight = MIN_RECENCY_WEIGHT,
  } = options

  const featured: T[] = []
  const keyed: { item: T; key: number }[] = []

  for (const item of items) {
    if (isFeatured(item)) {
      featured.push(item)
      continue
    }
    const weight = recencyWeight(getDate(item), now, halfLifeDays, minWeight)
    // ln(u) / weight orders items exactly like u^(1/weight); 1 - random() is in (0, 1], so the log is always finite.
    keyed.push({ item, key: Math.log(1 - random()) / weight })
  }

  shuffleInPlace(featured, random)
  keyed.sort((a, b) => b.key - a.key)

  return [...featured, ...keyed.map(({ item }) => item)]
}
