import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface PaperSheetProps {
  children: ReactNode
  className?: string
  labelledBy: string
}

/** A printed page that stays light even though the portal is dark, so documents read like real paper. */
export function PaperSheet({ children, className, labelledBy }: PaperSheetProps) {
  return (
    <article
      aria-labelledby={labelledBy}
      className={cn(
        "rounded-[3px] bg-paper p-6 text-paper-foreground shadow-xl ring-1 shadow-black/60 ring-black/10 sm:p-10",
        className
      )}
    >
      {children}
    </article>
  )
}

interface LetterheadProps {
  titleId: string
  title: string
  reference: string
}

export function Letterhead({ titleId, title, reference }: LetterheadProps) {
  return (
    <header className="mb-8 flex flex-wrap items-start justify-between gap-x-6 gap-y-4 border-b-2 border-primary pb-5">
      <div className="flex flex-col gap-0.5">
        <p className="font-heading text-lg font-bold tracking-[0.18em] uppercase">Purple Sector Visuals</p>
        <p className="font-sans text-xs text-paper-muted">Sports, Automotive, Portrait &amp; Event Photography</p>
      </div>
      <div className="flex flex-col items-start gap-0.5 sm:items-end">
        <h2 id={titleId} className="font-heading text-lg font-medium tracking-[0.2em] uppercase">
          {title}
        </h2>
        <p className="font-sans text-xs text-paper-muted tabular-nums">{reference}</p>
      </div>
    </header>
  )
}
