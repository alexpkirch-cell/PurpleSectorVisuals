"use client"

import Link from "next/link"
import { useState } from "react"
import { ArrowUpRight } from "lucide-react"

import { ImageSlot } from "@/components/image-slot"
import { cn } from "@/lib/utils"

type Side = "alex" | "gabe" | null

const creators = [
  {
    key: "alex" as const,
    name: "ALEX",
    subtitle: "Pace, Apex, & Burst Tracking",
    slotLabel: "ALEX // PORTRAIT SLOT",
    cards: ["BTS Slot", "Lifestyle Slot", "Detail Slot"],
    href: "/alex",
  },
  {
    key: "gabe" as const,
    name: "GABE",
    subtitle: "Atmosphere, Tone, & Form",
    slotLabel: "GABE // PORTRAIT SLOT",
    cards: ["Mood Slot", "Vibe Slot", "Form Slot"],
    href: "/gabe",
  },
]

const cardOffsets = [
  "-right-6 -top-6 w-20 rotate-6 sm:-right-10 sm:-top-8 sm:w-28",
  "-left-6 top-1/3 w-16 -rotate-6 sm:-left-10 sm:w-24",
  "-right-4 bottom-0 w-16 rotate-3 sm:-right-6 sm:w-24",
]

export function DualSplitSection() {
  const [hovered, setHovered] = useState<Side>(null)

  return (
    <section className="w-full bg-[#09090b]">
      <div className="mx-auto max-w-6xl px-6 pb-6 pt-24 sm:px-10">
        <p className="font-heading text-xs font-semibold uppercase tracking-[0.3em] text-[#e829f1]">
          Two Perspectives, One Studio
        </p>
        <h2 className="mt-4 max-w-2xl text-balance font-heading text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Two eyes on every frame.
        </h2>
      </div>

      {/* Desktop fluid split */}
      <div className="hidden min-h-[85vh] w-full md:flex">
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
                "group relative flex h-full flex-col justify-between px-8 py-14 transition-[flex-grow] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] sm:px-10",
                isHovered && "grow-[60]",
                isOther && "grow-[40]",
                !hovered && "grow-[50]"
              )}
              style={{ flexBasis: 0 }}
            >
              <div
                className={cn(
                  "absolute inset-0 -z-10 bg-[#0c0c0e] transition-colors duration-700",
                  isOther && "bg-[#09090b]/95"
                )}
              />
              {creator.key === "alex" ? (
                <div className="absolute inset-y-0 right-0 z-10 w-px bg-zinc-800/80" />
              ) : null}

              <div className="relative z-10">
                <h3
                  className={cn(
                    "font-heading text-5xl font-bold tracking-tight text-foreground transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] sm:text-6xl",
                    isHovered && "scale-[1.02]"
                  )}
                >
                  {creator.name}
                </h3>
                <p className="mt-2 text-sm font-medium text-zinc-400 sm:text-base">
                  {creator.subtitle}
                </p>
              </div>

              <div className="relative z-10 mx-auto flex w-full max-w-sm flex-1 items-center justify-center py-10">
                <div className="relative aspect-[3/4] w-[70%]">
                  <ImageSlot
                    aspect="3:4 Slot"
                    label={creator.slotLabel}
                    className={cn(
                      "transition-all duration-500 ease-out",
                      isHovered &&
                        "border-[#e829f1] shadow-[0_0_28px_rgba(232,41,241,0.28)]"
                    )}
                  />
                  {creator.cards.map((card, i) => (
                    <div
                      key={card}
                      className={cn(
                        "absolute aspect-[3/4] transition-all duration-500 ease-out",
                        cardOffsets[i]
                      )}
                    >
                      <ImageSlot
                        aspect=""
                        label={card}
                        compact
                        className={cn(
                          "transition-all duration-500 ease-out",
                          isHovered &&
                            "border-[#e829f1] shadow-[0_0_20px_rgba(232,41,241,0.24)]"
                        )}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative z-10 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
                  View Profile
                </span>
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#e829f1] text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <ArrowUpRight className="size-5" />
                </span>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Mobile stacked profiles */}
      <div className="flex flex-col gap-14 px-6 pb-12 md:hidden">
        {creators.map((creator) => (
          <div key={creator.key} className="flex flex-col gap-6">
            <Link href={creator.href} className="flex flex-col gap-6">
              <div>
                <h3 className="font-heading text-4xl font-bold tracking-tight text-foreground">
                  {creator.name}
                </h3>
                <p className="mt-1 text-sm font-medium text-zinc-400">
                  {creator.subtitle}
                </p>
              </div>
              <div className="aspect-[3/4] w-full">
                <ImageSlot aspect="3:4 Slot" label={creator.slotLabel} />
              </div>
            </Link>

            <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory [scrollbar-width:none]">
              {creator.cards.map((card) => (
                <div
                  key={card}
                  className="aspect-[3/4] w-32 shrink-0 snap-start"
                >
                  <ImageSlot aspect="" label={card} compact />
                </div>
              ))}
            </div>

            <Link
              href={creator.href}
              className="flex items-center justify-between rounded-full border border-zinc-800 bg-zinc-950/60 px-5 py-3"
            >
              <span className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
                View Profile
              </span>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#e829f1] text-white">
                <ArrowUpRight className="size-4" />
              </span>
            </Link>
          </div>
        ))}
      </div>
    </section>
  )
}
