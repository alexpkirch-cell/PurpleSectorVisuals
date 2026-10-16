"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"

import { isVideoUrl, type DirectoryMember } from "@/lib/team-directory"

const MAX_VISIBLE_BADGES = 5
const CUTOUT_WIDTH = "42%"

function HighlightCarousel({ media }: { media: string[] }) {
  const [index, setIndex] = useState(0)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (media.length < 2) return
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % media.length), 2600)
    return () => window.clearInterval(timer)
  }, [media.length])

  const url = media[index % media.length]

  return (
    <div className="relative size-full overflow-hidden rounded-xl bg-muted">
      <AnimatePresence initial={false}>
        <motion.div
          key={`${url}-${index}`}
          className="absolute inset-0"
          initial={{ opacity: 0, scale: reduceMotion ? 1 : 1.06 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.7, ease: "easeOut" }}
        >
          {isVideoUrl(url) ? (
            <video
              src={url}
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              aria-hidden="true"
              className="size-full object-cover"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="size-full object-cover" />
          )}
        </motion.div>
      </AnimatePresence>
      {media.length > 1 ? (
        <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1" aria-hidden="true">
          {media.map((item, dot) => (
            <span
              key={`${item}-${dot}`}
              className={`h-1 rounded-full transition-all ${dot === index % media.length ? "w-4 bg-primary" : "w-1 bg-foreground/50"}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function TeamCard({ member }: { member: DirectoryMember }) {
  const [active, setActive] = useState(false)
  const reduceMotion = useReducedMotion()

  const badges = [
    ...member.roles.map((label) => ({ label, kind: "role" as const })),
    ...member.specialties.map((label) => ({ label, kind: "specialty" as const })),
  ]
  const visibleBadges = badges.slice(0, MAX_VISIBLE_BADGES)
  const hiddenCount = badges.length - visibleBadges.length
  const hasMedia = member.highlight_media.length > 0
  const hasCutout = Boolean(member.cutout_image_url)
  const showMedia = active && hasMedia
  const contentLeft = hasCutout ? CUTOUT_WIDTH : "0%"
  const fade = { duration: reduceMotion ? 0 : 0.4, ease: "easeOut" } as const

  return (
    <Link
      href={`/team/${member.slug}`}
      aria-label={`View ${member.name}'s profile`}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onFocus={() => setActive(true)}
      onBlur={() => setActive(false)}
      className="group block rounded-2xl pt-12 outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative h-72 sm:h-80">
        <div className="absolute inset-0 rounded-2xl border border-border bg-card transition-colors group-hover:border-primary/60 group-focus-visible:border-primary" />

        {hasCutout ? (
          <div className="pointer-events-none absolute bottom-0 left-0 h-[calc(100%+3rem)]" style={{ width: CUTOUT_WIDTH }}>
            <Image
              src={member.cutout_image_url as string}
              alt={member.name}
              fill
              sizes="(min-width: 1280px) 22vw, (min-width: 640px) 40vw, 45vw"
              className="object-contain object-bottom"
            />
          </div>
        ) : null}

        <motion.div
          className="absolute inset-y-0 right-0 flex flex-col justify-center gap-3 py-6 pr-5 pl-3 sm:pr-8 sm:pl-4"
          style={{ left: contentLeft, pointerEvents: showMedia ? "none" : "auto" }}
          animate={{ opacity: showMedia ? 0 : 1, x: showMedia && !reduceMotion ? 32 : 0 }}
          transition={fade}
          aria-hidden={showMedia}
        >
          <h3 className="font-heading text-2xl font-medium text-balance text-foreground sm:text-3xl">{member.name}</h3>
          {member.bio ? (
            <p className="line-clamp-3 text-sm leading-relaxed text-pretty text-muted-foreground sm:line-clamp-4">
              {member.bio}
            </p>
          ) : null}
          {visibleBadges.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {visibleBadges.map((badge) => (
                <li
                  key={`${badge.kind}-${badge.label}`}
                  className={
                    badge.kind === "role"
                      ? "rounded-full border border-primary/40 bg-primary/15 px-2.5 py-0.5 font-mono text-[11px] tracking-wider text-primary uppercase"
                      : "rounded-full border border-border px-2.5 py-0.5 font-mono text-[11px] tracking-wider text-muted-foreground uppercase"
                  }
                >
                  {badge.label}
                </li>
              ))}
              {hiddenCount > 0 ? (
                <li className="rounded-full px-1 py-0.5 font-mono text-[11px] text-muted-foreground">+{hiddenCount}</li>
              ) : null}
            </ul>
          ) : null}
        </motion.div>

        <AnimatePresence>
          {showMedia ? (
            <motion.div
              className="absolute inset-y-4 right-4"
              style={{ left: `calc(${contentLeft} + 0.5rem)` }}
              initial={{ opacity: 0, x: reduceMotion ? 0 : 32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: reduceMotion ? 0 : 16 }}
              transition={fade}
            >
              <HighlightCarousel media={member.highlight_media} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </Link>
  )
}
