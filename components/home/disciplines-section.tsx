import Image from "next/image"
import Link from "next/link"

import { disciplines } from "@/lib/site-data"

export function DisciplinesSection() {
  return (
    <section className="w-full bg-background">
      <div className="mx-auto max-w-6xl px-6 py-24 sm:px-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-heading text-xs font-semibold uppercase tracking-[0.3em] text-primary">
              Disciplines
            </p>
            <h2 className="mt-4 max-w-xl text-balance font-heading text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Built for four disciplines.
            </h2>
          </div>
          <Link
            href="/work"
            className="hidden shrink-0 rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary sm:inline-flex"
          >
            See all work
          </Link>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {disciplines.map((discipline) => (
            <Link
              key={discipline.name}
              href={`/work?category=${discipline.name}`}
              className="group relative flex h-80 flex-col justify-end overflow-hidden rounded-3xl border border-border"
            >
              <Image
                src={discipline.image}
                alt={`${discipline.name} photography by Purple Sector Visuals`}
                fill
                className="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
              <div className="relative z-10 p-6">
                <h3 className="font-heading text-2xl font-bold tracking-tight text-foreground">
                  {discipline.name}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {discipline.description}
                </p>
              </div>
            </Link>
          ))}
        </div>

        <Link
          href="/work"
          className="mt-6 inline-flex w-full items-center justify-center rounded-full border border-border px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary sm:hidden"
        >
          See all work
        </Link>
      </div>
    </section>
  )
}
