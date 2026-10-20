"use client"

import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import { ArrowLeft } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import type { DirectoryMember } from "@/lib/team-directory"
import { cn } from "@/lib/utils"

function SpecBadges({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className="flex flex-col gap-3 border-b border-border py-5 first:pt-0">
      <dt className="font-mono text-[11px] tracking-[0.25em] text-muted-foreground uppercase">{label}</dt>
      <dd>
        <ul className="flex flex-wrap gap-2">
          {items.map((item) => (
            <li
              key={item}
              className="rounded-full bg-brand-pink px-3.5 py-1 font-mono text-xs font-semibold tracking-wider text-background uppercase"
            >
              {item}
            </li>
          ))}
        </ul>
      </dd>
    </div>
  )
}

export function MemberHero({ member }: { member: DirectoryMember }) {
  const reduceMotion = useReducedMotion()
  const offset = reduceMotion ? 0 : 1
  const hasCutout = Boolean(member.cutout_image_url)

  return (
    <section className="relative mx-auto flex w-full max-w-7xl flex-col gap-10 overflow-hidden px-4 pt-32 sm:px-6 lg:min-h-[min(88svh,1000px)] lg:flex-row lg:items-end lg:gap-8">
      {hasCutout ? (
        <motion.div
          className="relative order-2 flex h-[62svh] items-end justify-center lg:order-1 lg:h-[min(82svh,900px)] lg:w-1/2"
          initial={{ opacity: 0, x: -60 * offset }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.9, ease: "easeOut" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={member.cutout_image_url as string}
            alt={member.name}
            className="max-h-full w-auto max-w-full object-contain object-bottom drop-shadow-[0_30px_50px_rgba(0,0,0,0.6)]"
          />
        </motion.div>
      ) : null}

      <motion.div
        className={cn(
          "relative z-10 order-1 flex flex-col gap-8 pb-12 lg:order-2 lg:pb-24",
          hasCutout ? "lg:w-1/2" : "max-w-2xl"
        )}
        initial={{ opacity: 0, x: 40 * offset }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.7, ease: "easeOut", delay: reduceMotion ? 0 : 0.1 }}
      >
        <div className="flex flex-col gap-5">
          <Link
            href="/team"
            className="inline-flex w-fit items-center gap-2 font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            All team
          </Link>
          <h1 className="font-heading text-6xl leading-none font-medium text-balance text-foreground sm:text-8xl">
            {member.name}
          </h1>
        </div>

        <section aria-labelledby="loadout-heading" className="rounded-3xl border border-border bg-card p-6 sm:p-8">
          <header className="mb-6 flex items-center justify-between gap-4 border-b border-border pb-4">
            <h2 id="loadout-heading" className="font-mono text-xs tracking-[0.25em] text-primary uppercase">
              Tech Specs / Loadout
            </h2>
            <span className="font-mono text-[11px] text-muted-foreground uppercase">PSV crew</span>
          </header>

          <dl className="flex flex-col">
            <SpecBadges label="Roles" items={member.roles} />
            <SpecBadges label="Specialties" items={member.specialties} />
            {member.bio ? (
              <div className="flex flex-col gap-3 pt-5">
                <dt className="font-mono text-[11px] tracking-[0.25em] text-muted-foreground uppercase">Bio</dt>
                <dd className="text-base leading-relaxed whitespace-pre-line text-pretty text-foreground/90">
                  {member.bio}
                </dd>
              </div>
            ) : null}
          </dl>
        </section>

        <Link href="/contact" className={cn(buttonVariants({ size: "lg" }), "w-fit rounded-full px-6")}>
          Book a session
        </Link>
      </motion.div>
    </section>
  )
}
