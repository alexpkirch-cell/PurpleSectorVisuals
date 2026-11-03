"use client"

import { Check } from "lucide-react"

import { TRACKER_NODES, trackerIndex } from "@/lib/vault-progress"
import { cn } from "@/lib/utils"

interface TrackerTabProps {
  shootStatus: string | null
  photoCount: number
}

export function TrackerTab({ shootStatus, photoCount }: TrackerTabProps) {
  const current = trackerIndex(shootStatus, photoCount)
  const lastIndex = TRACKER_NODES.length - 1
  const isComplete = current === lastIndex
  const fillPercent = current < 0 ? 0 : (current / lastIndex) * 100
  const active = current >= 0 ? TRACKER_NODES[current] : null

  return (
    <section aria-labelledby="tracker-heading" className="flex flex-col gap-8 rounded-2xl border border-border bg-card p-5 sm:p-8">
      <div className="flex flex-col gap-1">
        <h2 id="tracker-heading" className="font-heading text-base font-medium text-foreground">
          Project Tracker
        </h2>
        <p className="text-sm text-muted-foreground">This updates automatically as your project moves through production.</p>
      </div>

      <div className="relative">
        <div aria-hidden="true" className="absolute top-4 right-[10%] left-[10%] h-1 -translate-y-1/2 rounded-full bg-border">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
            style={{ width: `${fillPercent}%` }}
          />
        </div>

        <ol className="relative grid grid-cols-5">
          {TRACKER_NODES.map((node, index) => {
            const done = index < current || isComplete
            const isCurrent = index === current && !isComplete
            return (
              <li key={node.id} className="flex flex-col items-center gap-3 text-center">
                <div
                  aria-current={isCurrent ? "step" : undefined}
                  className={cn(
                    "relative flex h-8 w-8 items-center justify-center rounded-full border-2 bg-card text-xs font-semibold transition-colors duration-500",
                    done && "border-primary bg-primary text-primary-foreground",
                    isCurrent && "border-primary text-primary",
                    !done && !isCurrent && "border-border text-muted-foreground"
                  )}
                >
                  {isCurrent && <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full bg-primary/30" />}
                  {done ? <Check className="relative h-4 w-4" /> : <span className="relative">{index + 1}</span>}
                </div>
                <span
                  className={cn(
                    "text-xs leading-tight font-medium sm:text-sm",
                    done || isCurrent ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {node.label}
                </span>
              </li>
            )
          })}
        </ol>
      </div>

      <div className="flex flex-col gap-1 rounded-xl border border-border bg-background p-4" aria-live="polite">
        <p className="font-heading text-sm font-medium text-foreground">
          {active ? active.headline : "Waiting on your booking"}
        </p>
        <p className="text-sm text-muted-foreground">
          {active
            ? active.detail
            : "Once your agreement is signed and your retainer is in, your project will appear on the tracker."}
        </p>
      </div>
    </section>
  )
}
