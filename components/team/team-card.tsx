"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import { User } from "lucide-react"

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
        <img src={url} alt="" loading="lazy" className="size-full object-cover" />
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
      href={`/team/${member.slug}`}
      aria-label={`View ${member.name}'s profile`}
      className="group block rounded-3xl pt-24 outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative min-h-[26rem]">
        <div className="absolute inset-0 rounded-3xl border border-border bg-card transition-colors duration-300 group-hover:border-primary/50" />
        <div className="pointer-events-none absolute inset-0 rounded-3xl bg-foreground/0 transition-colors duration-300 group-hover:bg-foreground/[0.06]" />

        {hasCutout ? (
          <motion.div
            className={cn("absolute bottom-0 h-[calc(100%+6rem)] w-[44%]", reversed ? "right-0" : "left-0")}
            style={{ transformOrigin: "50% 100%" }}
            whileHover={reduceMotion ? undefined : { scale: 1.05 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
          >
            <Image
              src={member.cutout_image_url as string}
              alt={member.name}
              fill
              sizes="(min-width: 1024px) 30vw, 44vw"
              className="object-contain object-bottom drop-shadow-[0_20px_30px_rgba(0,0,0,0.5)]"
            />
          </motion.div>
        ) : (
          <div
            className={cn(
              "pointer-events-none absolute top-6 bottom-6 flex w-[40%] flex-col items-center justify-end gap-2 rounded-2xl border-2 border-dashed border-muted-foreground/40 bg-muted/30 pb-4",
              reversed ? "right-6" : "left-6"
            )}
            aria-hidden="true"
          >
            <User className="size-24 text-muted-foreground/40 sm:size-32" strokeWidth={1} />
            <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground/70 uppercase">Cutout PNG</span>
          </div>
        )}

        <div
          className={cn(
            "relative flex min-h-[26rem] w-[54%] flex-col justify-center gap-5 py-8",
            reversed ? "mr-auto pr-2 pl-6 sm:pl-10" : "ml-auto pr-6 pl-2 sm:pr-10"
          )}
        >
          <motion.div
            className="flex flex-col gap-4"
            animate={{ y: boxHovered && !reduceMotion ? -10 : 0, opacity: boxHovered ? 0.6 : 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
          >
            <h3 className="font-heading text-3xl font-bold text-balance text-foreground sm:text-5xl">{member.name}</h3>

            {badges.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {badges.map((badge) => (
                  <li
                    key={`${badge.kind}-${badge.label}`}
                    className={cn(
                      "rounded-full border border-primary/50 px-3 py-1 font-mono text-[11px] tracking-wider text-primary uppercase",
                      badge.kind === "role" ? "bg-primary/15" : "bg-transparent"
                    )}
                  >
                    {badge.label}
                  </li>
                ))}
              </ul>
            ) : null}

            {member.bio ? (
              <p className="line-clamp-4 text-sm leading-relaxed text-pretty text-muted-foreground sm:text-base">{member.bio}</p>
            ) : null}
          </motion.div>

          {visibleMedia.length > 0 ? (
            <ul
              className="flex items-center gap-2"
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
