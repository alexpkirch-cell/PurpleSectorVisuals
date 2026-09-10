import Image from "next/image"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

import { galleryItems, type GalleryItem } from "@/lib/site-data"
import { cn } from "@/lib/utils"

interface CreatorPageProps {
  name: "Alex" | "Gabe"
  role: string
  bio: string
  heroImage: string
  stats: { label: string; value: string }[]
}

export function CreatorPage({
  name,
  role,
  bio,
  heroImage,
  stats,
}: CreatorPageProps) {
  const shots: GalleryItem[] = galleryItems.filter(
    (item) => item.creator === name
  )

  return (
    <div className="bg-background">
      <section className="relative flex min-h-[80svh] w-full items-end overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src={heroImage}
            alt={`${name}, Purple Sector Visuals creator`}
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-background/10" />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-16 pt-40 sm:px-10">
          <p className="font-heading text-xs font-semibold uppercase tracking-[0.3em] text-primary">
            {role}
          </p>
          <h1 className="mt-4 text-balance font-heading text-6xl font-bold tracking-tight text-foreground sm:text-8xl">
            {name}
          </h1>
          <p className="mt-6 max-w-lg text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            {bio}
          </p>

          <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
            {stats.map((stat) => (
              <div key={stat.label}>
                <dt className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {stat.label}
                </dt>
                <dd className="mt-1 font-heading text-2xl font-bold text-foreground">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20 sm:px-10">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Selected work
          </h2>
          <Link
            href="/work"
            className="hidden shrink-0 items-center gap-1 rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary sm:inline-flex"
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
                "group relative overflow-hidden rounded-2xl border border-border",
                i % 3 === 0 ? "col-span-2 aspect-[16/10] sm:col-span-1 sm:aspect-[3/4]" : "aspect-[3/4]"
              )}
            >
              <Image
                src={shot.image}
                alt={shot.title}
                fill
                className="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="absolute inset-x-0 bottom-0 p-4 opacity-0 transition-opacity group-hover:opacity-100">
                <p className="text-sm font-medium text-foreground">
                  {shot.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {shot.category}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="sticky bottom-0 z-30 border-t border-border bg-card/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4 sm:px-10">
          <p className="text-sm text-muted-foreground">
            Ready to shoot with {name}?
          </p>
          <Link
            href={`/contact?shooter=${name}`}
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.03] active:scale-[0.98]"
          >
            Book with {name}
            <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
