"use client"

import { useState } from "react"
import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import { User } from "lucide-react"

import { isFounderSlug } from "@/lib/shooter-link"
import { isVideoUrl, type DirectoryMember } from "@/lib/team-directory"
import { cn } from "@/lib/utils"

const MAX_HIGHLIGHT_BOXES = 4
const BOX_WIDTH = 88
const BOX_WIDTH_ACTIVE = 128

function HighlightBox({ url, active, dimmed }: { url: string; active: boolean; dimmed: boolean }) {
  return (
    <motion.div
      className="relative h-20 shrink-0 overflow-hidden rounded-lg border border-border bg-muted"
      animate={{ width: active ? BOX_WIDTH_ACTIVE : BOX_WIDTH, scale: active ? 1.08 : 1, opacity: dimmed ? 0.6 : 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      style={{ zIndex: active ? 2 : 1 }}
    >
      {isVideoUrl(url) ? (
        <video src={url} muted loop playsInline autoPlay preload="metadata" aria-hidden="true" className="size-full object-cover" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
      )}
    </motion.div>
  )
}

export function TeamCard({ member, reversed = false }: { member: DirectoryMember; reversed?: boolean }) {
  const reduceMotion = useReducedMotion()
  const [hoveredBox, setHoveredBox] = useState<number | null>(null)

  const badges = [
    ...member.roles.map((label) => ({ label, kind: "role" as const })),
    ...member.specialties.map((label) => ({ label, kind: "specialty" as const })),
  ]
  const visibleMedia = member.highlight_media.slice(0, MAX_HIGHLIGHT_BOXES)
  const hiddenMedia = member.highlight_media.length - visibleMedia.length
  const hasCutout = Boolean(member.cutout_image_url)
  const boxHovered = hoveredBox !== null

  return (
    <Link
      href={isFounderSlug(member.slug) ? `/${member.slug}` : `/team/${member.slug}`}
      aria-label={`View ${member.name}'s profile`}
      className="group block rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-ring md:pt-24"
    >
      <div className="relative flex flex-col md:block md:min-h-[26rem]">
        <div className="absolute inset-0 rounded-3xl border border-border bg-card transition-colors duration-300 group-hover:border-primary/50" />
        <div className="pointer-events-none absolute inset-0 rounded-3xl bg-foreground/0 transition-colors duration-300 group-hover:bg-foreground/[0.06]" />

        {hasCutout ? (
          <motion.div
            className={cn(
              // Phones: a full-width 3:4 block at the top of the card. md and up: pinned beside the text, popping out of the card on lg.
              "relative mx-auto mt-6 aspect-[3/4] w-[calc(100%-3rem)] max-w-md md:absolute md:bottom-0 md:mx-0 md:mt-0 md:w-[44%] md:max-w-none lg:h-[calc(100%+6rem)] lg:w-auto lg:max-w-[44%]",
              reversed ? "md:right-0" : "md:left-0"
            )}
            style={{ transformOrigin: "50% 100%" }}
            whileHover={reduceMotion ? undefined : { scale: 1.05 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={member.cutout_image_url as string}
              alt={member.name}
              className="absolute inset-0 size-full object-cover object-center drop-shadow-[0_20px_30px_rgba(0,0,0,0.5)]"
            />
          </motion.div>
        ) : (
          <div
            className={cn(
              "pointer-events-none relative mx-6 mt-6 flex h-56 flex-col items-center justify-end gap-2 rounded-2xl border-2 border-dashed border-muted-foreground/40 bg-muted/30 pb-4 md:absolute md:inset-y-6 md:mx-0 md:mt-0 md:h-auto md:w-[40%]",
              reversed ? "md:right-6" : "md:left-6"
            )}
            aria-hidden="true"
          >
            <User className="size-24 text-muted-foreground/40 sm:size-32" strokeWidth={1} />
            <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground/70 uppercase">Cutout PNG</span>
          </div>
        )}

        <div
          className={cn(
            "relative flex w-full flex-col justify-center gap-5 px-6 py-6 sm:px-8 md:min-h-[26rem] md:w-[54%] md:py-8",
            reversed ? "md:mr-auto md:pr-2 md:pl-6 lg:pl-10" : "md:ml-auto md:pr-6 md:pl-2 lg:pr-10"
          )}
        >
          <div className="flex flex-col gap-4">
            <h3 className="font-heading text-3xl font-bold text-balance text-foreground sm:text-5xl">{member.name}</h3>

            {badges.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {badges.map((badge) => (
                  <li
                    key={`${badge.kind}-${badge.label}`}
                    className="rounded-full bg-brand-pink px-3 py-1 font-mono text-[11px] font-semibold tracking-wider text-background uppercase"
                  >
                    {badge.label}
                  </li>
                ))}
              </ul>
            ) : null}

            {member.bio ? (
              <motion.p
                className="line-clamp-4 text-sm leading-relaxed text-pretty text-muted-foreground sm:text-base"
                animate={{ y: boxHovered && !reduceMotion ? -14 : 0, opacity: boxHovered ? 0.45 : 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 26 }}
              >
                {member.bio}
              </motion.p>
            ) : null}
          </div>

          {visibleMedia.length > 0 ? (
            <ul
              className="flex flex-wrap items-center gap-2"
              aria-label={`${member.name} highlight media`}
              onMouseLeave={() => setHoveredBox(null)}
            >
              {visibleMedia.map((url, index) => (
                <li key={`${url}-${index}`} className="contents" onMouseEnter={() => setHoveredBox(index)}>
                  <HighlightBox url={url} active={hoveredBox === index} dimmed={boxHovered && hoveredBox !== index} />
                </li>
              ))}
              {hiddenMedia > 0 ? <li className="pl-1 font-mono text-xs text-muted-foreground">+{hiddenMedia}</li> : null}
            </ul>
          ) : null}
        </div>
      </div>
    </Link>
  )
}
