"use client"

import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useMemo } from "react"

import type { PortfolioCategory, PortfolioItem } from "@/app/actions/portfolio"
import { cn } from "@/lib/utils"

type Discipline = "Portraits" | "Sports" | "Automotive" | "Events"

const CATEGORY_TO_DISCIPLINE: Record<PortfolioCategory, Discipline> = {
  portraits: "Portraits",
  athletics: "Sports",
  automotive: "Automotive",
  events: "Events",
}

const filters: (Discipline | "All")[] = ["All", "Portraits", "Sports", "Automotive", "Events"]

export function GalleryGrid({ items }: { items: PortfolioItem[] }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const active = (searchParams.get("category") as Discipline | null) ?? "All"

  const filtered = useMemo(() => {
    if (active === "All") return items
    return items.filter((item) => CATEGORY_TO_DISCIPLINE[item.category] === active)
  }, [items, active])

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
      <div className="sticky top-20 z-20 -mx-6 flex gap-2 overflow-x-auto bg-[#09090b]/80 px-6 py-4 backdrop-blur-md sm:-mx-10 sm:justify-center sm:px-10">
        {filters.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setFilter(filter)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
              active === filter
                ? "bg-[#e829f1] text-white"
                : "bg-zinc-900 text-zinc-400 hover:text-foreground"
            )}
          >
            {filter === "All" ? "All Work" : filter}
          </button>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {filtered.map((item, i) => (
          <div
            key={item.id}
            className={cn(
              "group relative overflow-hidden rounded-2xl border border-zinc-800/80 transition-colors duration-300 ease-out hover:border-[#e829f1] hover:shadow-[0_0_24px_rgba(232,41,241,0.22)]",
              i % 5 === 0
                ? "col-span-2 aspect-[16/10] sm:aspect-[4/3]"
                : "aspect-[3/4]"
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- portfolio images are served from the public portfolio-images bucket */}
            <img
              src={item.image_url || "/placeholder.svg"}
              alt={item.title}
              crossOrigin="anonymous"
              className="size-full object-cover transition-all duration-500 ease-in-out group-hover:scale-105 group-hover:blur-[3px]"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <div className="px-4 text-center">
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <p className="text-xs text-zinc-300">{CATEGORY_TO_DISCIPLINE[item.category]}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="mt-16 text-center text-sm text-zinc-500">No work in this category yet.</p>
      ) : null}
    </div>
  )
}
