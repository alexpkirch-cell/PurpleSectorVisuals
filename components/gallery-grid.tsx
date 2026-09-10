"use client"

import Image from "next/image"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useMemo } from "react"

import { galleryItems, type Discipline } from "@/lib/site-data"
import { cn } from "@/lib/utils"

const filters: (Discipline | "All")[] = [
  "All",
  "Sports",
  "Automotive",
  "Portraits",
  "Events",
]

export function GalleryGrid() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const active = (searchParams.get("category") as Discipline | null) ?? "All"

  const items = useMemo(() => {
    if (active === "All") return galleryItems
    return galleryItems.filter((item) => item.category === active)
  }, [active])

  function setFilter(value: Discipline | "All") {
    const params = new URLSearchParams(searchParams.toString())
    if (value === "All") {
      params.delete("category")
    } else {
      params.set("category", value)
    }
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  return (
    <div>
      <div className="sticky top-20 z-20 -mx-6 flex gap-2 overflow-x-auto bg-background/80 px-6 py-4 backdrop-blur-xl sm:-mx-10 sm:justify-center sm:px-10">
        {filters.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setFilter(filter)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
              active === filter
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            {filter === "All" ? "All Work" : filter}
          </button>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item, i) => (
          <div
            key={item.id}
            className={cn(
              "group relative overflow-hidden rounded-2xl border border-border",
              i % 5 === 0
                ? "col-span-2 aspect-[16/10] sm:aspect-[4/3]"
                : "aspect-[3/4]"
            )}
          >
            <Image
              src={item.image}
              alt={item.title}
              fill
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/85 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="absolute inset-x-0 bottom-0 translate-y-2 p-4 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
              <p className="text-sm font-medium text-foreground">
                {item.title}
              </p>
              <p className="text-xs text-muted-foreground">
                {item.category} &middot; {item.creator}
              </p>
            </div>
          </div>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="mt-16 text-center text-sm text-muted-foreground">
          No work in this category yet.
        </p>
      ) : null}
    </div>
  )
}
