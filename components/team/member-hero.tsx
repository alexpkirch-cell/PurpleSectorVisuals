"use client"

import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import { ArrowLeft } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import type { DirectoryMember } from "@/lib/team-directory"
import { cn } from "@/lib/utils"

export function MemberHero({ member }: { member: DirectoryMember }) {
  const reduceMotion = useReducedMotion()
  const offset = reduceMotion ? 0 : 1

  return (
    <section className="relative mx-auto flex w-full max-w-7xl flex-col justify-end gap-10 overflow-hidden px-4 pt-32 sm:px-6 lg:min-h-[min(88svh,1000px)] lg:flex-row lg:items-end lg:justify-between lg:gap-4">
      <motion.div
        className="relative z-10 flex max-w-2xl flex-col gap-6 pb-12 lg:pb-24"
        initial={{ opacity: 0, x: -40 * offset }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.7, ease: "easeOut" }}
      >
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

        {member.roles.length > 0 || member.specialties.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {member.roles.map((role) => (
              <li
                key={`r-${role}`}
                className="rounded-full border border-primary/40 bg-primary/15 px-3 py-1 font-mono text-xs tracking-wider text-primary uppercase"
              >
                {role}
              </li>
            ))}
            {member.specialties.map((specialty) => (
              <li
                key={`s-${specialty}`}
                className="rounded-full border border-border px-3 py-1 font-mono text-xs tracking-wider text-muted-foreground uppercase"
              >
                {specialty}
              </li>
            ))}
          </ul>
        ) : null}

        {member.bio ? (
          <p className="text-lg leading-relaxed whitespace-pre-line text-pretty text-muted-foreground">{member.bio}</p>
        ) : null}

        <Link href="/contact" className={cn(buttonVariants({ size: "lg" }), "w-fit rounded-full px-6")}>
          Book a session
        </Link>
      </motion.div>

      {member.cutout_image_url ? (
        <motion.div
          className="relative flex h-[60svh] items-end justify-center lg:h-[min(78svh,860px)] lg:w-1/2"
          initial={{ opacity: 0, x: 60 * offset }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.9, ease: "easeOut", delay: reduceMotion ? 0 : 0.1 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={member.cutout_image_url} alt={member.name} className="max-h-full w-auto max-w-full object-contain object-bottom" />
        </motion.div>
      ) : null}
    </section>
  )
}
