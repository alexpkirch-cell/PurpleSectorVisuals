"use client"

import { Camera, MapPin } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { Shoot } from "@/app/actions/shoots"
import { formatShootDate, leadShooterOf, packageOf, STATUS_LABELS } from "@/lib/operations"

export function UpcomingSchedule({ shoots, onOpen }: { shoots: Shoot[]; onOpen: (shoot: Shoot) => void }) {
  return (
    <section aria-labelledby="upcoming-schedule-heading" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 id="upcoming-schedule-heading" className="font-heading text-base font-medium text-foreground">
          Upcoming Schedule
        </h2>
        <span className="text-xs text-muted-foreground">{shoots.length} scheduled</span>
      </div>

      {shoots.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No upcoming shoots on the calendar.</p>
      ) : (
        <ol className="flex flex-col divide-y divide-border">
          {shoots.slice(0, 8).map((shoot) => {
            const shooter = leadShooterOf(shoot)
            return (
              <li key={shoot.id}>
                <button
                  type="button"
                  onClick={() => onOpen(shoot)}
                  className="flex w-full items-start gap-3 rounded-md py-3 text-left transition-colors hover:bg-accent/50"
                >
                  <span className="flex w-14 shrink-0 flex-col items-center rounded-lg border border-border bg-background px-1 py-1.5">
                    <span className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
                      {formatShootDate(shoot.shoot_date, true)?.split(",")[0]}
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {formatShootDate(shoot.shoot_date)}
                    </span>
                  </span>

                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-sm font-medium text-foreground">{shoot.client_name}</span>
                    <span className="truncate text-xs text-muted-foreground">{packageOf(shoot)}</span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {shooter && (
                        <span className="flex items-center gap-1">
                          <Camera className="size-3" aria-hidden="true" />
                          {shooter}
                        </span>
                      )}
                      {shoot.location && (
                        <span className="flex min-w-0 items-center gap-1">
                          <MapPin className="size-3 shrink-0" aria-hidden="true" />
                          <span className="truncate">{shoot.location}</span>
                        </span>
                      )}
                    </span>
                  </span>

                  <Badge variant="outline" className="shrink-0 text-[0.65rem]">
                    {STATUS_LABELS[shoot.status]}
                  </Badge>
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
