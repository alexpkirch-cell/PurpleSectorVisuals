import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

import { ImageSlot } from "@/components/image-slot"
import { galleryItems, type GalleryItem } from "@/lib/site-data"
import type { SiteSlotOverrides } from "@/lib/site-slot-definitions"
import { cn } from "@/lib/utils"

interface CreatorPageProps {
  name: "Alex" | "Gabe"
  role: string
  bio: string
  specialties: string[]
  overrides?: SiteSlotOverrides
}

export function CreatorPage({
  name,
  role,
  bio,
  specialties,
  overrides,
}: CreatorPageProps) {
  const shots: GalleryItem[] = galleryItems.filter(
    (item) => item.creator === name
  )

  return (
    <div className="bg-[#09090b]">
      <section className="relative flex min-h-[80svh] w-full items-end overflow-hidden">
        <div className="absolute inset-0">
          <ImageSlot
            aspect="16:9 Slot"
            label={`${name} Portrait Slot`}
            className="border-none"
            slotKey={`creator.${name.toLowerCase()}.hero`}
            overrides={overrides}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/60 to-[#09090b]/20" />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-16 pt-40 sm:px-10">
          <p className="font-heading text-xs font-semibold uppercase tracking-[0.3em] text-[#e829f1]">
            {role}
          </p>
          <h1 className="mt-4 text-balance font-heading text-6xl font-bold tracking-tight text-foreground sm:text-8xl">
            {name}
          </h1>
          <p className="mt-6 max-w-lg text-pretty text-base leading-relaxed text-zinc-400 sm:text-lg">
            {bio}
          </p>

          <div className="mt-10 flex flex-wrap gap-2">
            {specialties.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-zinc-800 bg-zinc-950/60 px-4 py-1.5 text-xs font-medium text-zinc-400"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20 sm:px-10">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Selected work
          </h2>
          <Link
            href="/work"
            className="hidden shrink-0 items-center gap-1 rounded-full border border-zinc-800 px-5 py-2.5 text-sm font-medium text-foreground transition-all duration-500 ease-out hover:border-[#e829f1] hover:shadow-[0_0_24px_rgba(232,41,241,0.22)] sm:inline-flex"
          >
            Full gallery
            <ArrowUpRight className="size-4" />
          </Link>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {shots.map((shot, i) => (
            <div
              key={shot.id}
              className={cn(
                "group relative overflow-hidden rounded-2xl border border-zinc-800/80 transition-all duration-500 ease-out hover:scale-[1.02] hover:border-[#e829f1] hover:shadow-[0_0_24px_rgba(232,41,241,0.22)]",
                i % 3 === 0 ? "col-span-2 aspect-[16/10] sm:col-span-1 sm:aspect-[3/4]" : "aspect-[3/4]"
              )}
            >
              <ImageSlot
                aspect={shot.aspect}
                label=""
                className="border-none"
                slotKey={`gallery.${shot.id}`}
                overrides={overrides}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#09090b]/80 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="absolute inset-x-0 bottom-0 p-4 opacity-0 transition-opacity group-hover:opacity-100">
                <p className="text-sm font-medium text-foreground">
                  {shot.title}
                </p>
                <p className="text-xs text-zinc-500">
                  {shot.category}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="sticky bottom-0 z-30 border-t border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4 sm:px-10">
          <p className="text-sm text-zinc-400">
            Ready to shoot with {name}?
          </p>
          <Link
            href={`/contact?shooter=${name}`}
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#e829f1] px-6 py-3 text-sm font-medium text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            Book with {name}
            <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
