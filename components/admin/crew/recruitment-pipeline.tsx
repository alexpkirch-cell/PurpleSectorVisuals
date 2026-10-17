"use client"

import { useState, useTransition } from "react"
import { ExternalLink, UserCheck, X } from "lucide-react"
import { toast } from "sonner"

import {
  deleteApplication,
  promoteApplication,
  updateApplicationStatus,
  type RosterApplication,
} from "@/app/actions/crew"
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/crew-statuses"
import { Button } from "@/components/ui/button"

const COLUMN_LABELS: Record<ApplicationStatus, string> = {
  new: "New",
  reviewing: "Reviewing",
  accepted: "Accepted",
  declined: "Declined",
}

function portfolioHref(link: string | null) {
  if (!link) return null
  return /^https?:\/\//i.test(link) ? link : `https://${link}`
}

export function RecruitmentPipeline({ initialApplications }: { initialApplications: RosterApplication[] }) {
  const [applications, setApplications] = useState(initialApplications)
  const [pending, startTransition] = useTransition()

  function move(id: string, status: ApplicationStatus) {
    const previous = applications
    setApplications((list) => list.map((a) => (a.id === id ? { ...a, status } : a)))
    startTransition(async () => {
      try {
        await updateApplicationStatus(id, status)
      } catch (error) {
        setApplications(previous)
        toast.error(error instanceof Error ? error.message : "Could not update application")
      }
    })
  }

  function remove(id: string) {
    const previous = applications
    setApplications((list) => list.filter((a) => a.id !== id))
    startTransition(async () => {
      try {
        await deleteApplication(id)
      } catch (error) {
        setApplications(previous)
        toast.error(error instanceof Error ? error.message : "Could not delete application")
      }
    })
  }

  function promote(application: RosterApplication) {
    startTransition(async () => {
      try {
        await promoteApplication(application.id)
        setApplications((list) => list.map((a) => (a.id === application.id ? { ...a, status: "accepted" } : a)))
        toast.success(`${application.name} added to Active 1099s`)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not promote applicant")
      }
    })
  }

  if (applications.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        No applications yet. Submissions from the homepage Join the Roster form appear here.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {APPLICATION_STATUSES.map((status) => {
        const column = applications.filter((a) => a.status === status)
        return (
          <section key={status} aria-label={COLUMN_LABELS[status]} className="flex flex-col gap-2">
            <h3 className="flex items-center justify-between px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {COLUMN_LABELS[status]}
              <span>{column.length}</span>
            </h3>
            <ul className="flex min-h-24 flex-col gap-2 rounded-lg bg-muted/30 p-2">
              {column.map((application) => {
                const href = portfolioHref(application.portfolio_link)
                return (
                  <li key={application.id} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{application.name}</p>
                        <a
                          href={`mailto:${application.email}`}
                          className="block truncate text-xs text-muted-foreground hover:text-foreground"
                        >
                          {application.email}
                        </a>
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(application.id)}
                        aria-label={`Delete application from ${application.name}`}
                        className="text-muted-foreground transition-colors hover:text-destructive"
                      >
                        <X className="size-4" />
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-foreground underline-offset-4 hover:underline"
                        >
                          Portfolio <ExternalLink className="size-3" />
                        </a>
                      ) : null}
                      {application.instagram ? (
                        <a
                          href={`https://instagram.com/${application.instagram}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-foreground underline-offset-4 hover:underline"
                        >
                          @{application.instagram}
                        </a>
                      ) : null}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <label className="sr-only" htmlFor={`status-${application.id}`}>
                        Status for {application.name}
                      </label>
                      <select
                        id={`status-${application.id}`}
                        value={application.status}
                        disabled={pending}
                        onChange={(event) => move(application.id, event.target.value as ApplicationStatus)}
                        className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
                      >
                        {APPLICATION_STATUSES.map((value) => (
                          <option key={value} value={value}>
                            {COLUMN_LABELS[value]}
                          </option>
                        ))}
                      </select>
                      {status === "reviewing" || status === "new" ? (
                        <Button size="sm" variant="outline" disabled={pending} onClick={() => promote(application)}>
                          <UserCheck />
                          Accept
                        </Button>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
