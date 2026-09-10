"use client"

import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { ArrowUpRight } from "lucide-react"

import { cn } from "@/lib/utils"

type Side = "alex" | "gabe" | null

const creators = [
  {
    key: "alex" as const,
    name: "Alex",
    tagline: "Sports & Automotive",
    href: "/alex",
    image: "/images/alex-portrait.png",
  },
  {
    key: "gabe" as const,
    name: "Gabe",
    tagline: "Portraits & Events",
    href: "/gabe",
    image: "/images/gabe-portrait.png",
  },
]

export function DualSplitSection() {
  const [hovered, setHovered] = useState<Side>(null)

  return (
    <section className="w-full bg-background">
      <div className="mx-auto max-w-6xl px-6 pb-6 pt-24 sm:px-10">
        <p className="font-heading text-xs font-semibold uppercase tracking-[0.3em] text-primary">
          The Studio
        </p>
        <h2 className="mt-4 max-w-2xl text-balance font-heading text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Two eyes on every frame.
        </h2>
      </div>

      {/* Desktop fluid split */}
      <div className="hidden h-[70vh] w-full md:flex">
        {creators.map((creator) => {
          const isHovered = hovered === creator.key
          const isOther = hovered !== null && hovered !== creator.key

          return (
            <Link
              key={creator.key}
              href={creator.href}
              onMouseEnter={() => setHovered(creator.key)}
              onMouseLeave={() => setHovered(null)}
              className={cn(
                "group relative flex h-full items-end overflow-hidden transition-[flex-grow] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]",
                isHovered && "grow-[60]",
                isOther && "grow-[40]",
                !hovered && "grow-[50]"
              )}
              style={{ flexBasis: 0 }}
            >
              <Image
                src={creator.image}
                alt={`${creator.name}, Purple Sector Visuals creator`}
                fill
                className={cn(
                  "object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  isHovered ? "scale-105" : "scale-100"
                )}
              />
              <div
                className={cn(
                  "absolute inset-0 bg-background/70 transition-colors duration-700",
                  isHovered && "bg-background/30"
                )}
              />
              {creator.key === "alex" ? (
                <div className="absolute inset-y-0 right-0 w-px bg-border" />
              ) : null}

              <div className="relative z-10 flex w-full items-end justify-between gap-4 p-8 sm:p-10">
                <div>
                  <h3 className="font-heading text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
                    {creator.name}
                  </h3>
                  <p className="mt-2 text-sm font-medium text-muted-foreground sm:text-base">
                    {creator.tagline}
                  </p>
                </div>
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <ArrowUpRight className="size-5" />
                </span>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Mobile stacked cards */}
      <div className="flex flex-col gap-4 px-6 pb-4 md:hidden">
        {creators.map((creator) => (
          <Link
            key={creator.key}
            href={creator.href}
            className="relative flex h-72 items-end overflow-hidden rounded-3xl"
          >
            <Image
              src={creator.image}
              alt={`${creator.name}, Purple Sector Visuals creator`}
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-background/60" />
            <div className="relative z-10 flex w-full items-end justify-between gap-4 p-6">
              <div>
                <h3 className="font-heading text-3xl font-bold tracking-tight text-foreground">
                  {creator.name}
                </h3>
                <p className="mt-1 text-sm font-medium text-muted-foreground">
                  {creator.tagline}
                </p>
              </div>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <ArrowUpRight className="size-5" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
