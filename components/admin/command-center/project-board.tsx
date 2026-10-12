"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowRight, CreditCard, Loader2, PackageCheck } from "lucide-react"

import { deliverAndCharge, moveProject, type CommandCenterProject, type ProjectStatus } from "@/app/actions/command-center"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/components/admin/command-center/format"

const COLUMNS: { status: ProjectStatus; label: string; hint: string }[] = [
  { status: "Lead", label: "Lead", hint: "Awaiting 50% retainer" },
  { status: "Retainer_Paid", label: "Retainer Paid", hint: "Date locked, card on file" },
  { status: "Staging", label: "Staging", hint: "Shot, editing in progress" },
  { status: "Delivered", label: "Delivered", hint: "Balance collected, Vault unlocked" },
]

const NEXT_LABEL: Partial<Record<ProjectStatus, { to: ProjectStatus; label: string }>> = {
  Lead: { to: "Retainer_Paid", label: "Mark retainer paid" },
  Retainer_Paid: { to: "Staging", label: "Move to Staging" },
}

function ProjectCard({ project }: { project: CommandCenterProject }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const next = NEXT_LABEL[project.status]
  const balanceDue = project.totalPrice / 2

  function advance(to: ProjectStatus) {
    startTransition(async () => {
      const result = await moveProject(project.id, to)
      if (!result.success) toast.error(result.error)
      router.refresh()
    })
  }

  function deliver() {
    startTransition(async () => {
      const result = await deliverAndCharge(project.id)
      setConfirming(false)
      if (result.success) {
        toast.success(`Charged balance and delivered ${project.clientName}'s Vault.`)
      } else {
        toast.error(result.error)
      }
      router.refresh()
    })
  }

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium text-foreground">{project.clientName}</h3>
          <p className="truncate text-xs text-muted-foreground">{project.clientEmail}</p>
        </div>
        <Badge variant="secondary">{project.serviceTier}</Badge>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Total</span>
        <span className="font-semibold text-foreground">{formatCurrency(project.totalPrice)}</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Badge variant={project.depositPaid ? "default" : "outline"}>
          {project.depositPaid ? "50% retainer paid" : "Retainer unpaid"}
        </Badge>
        {project.cardOnFile && (
          <Badge variant="outline" className="gap-1">
            <CreditCard className="size-3" />
            Card on file
          </Badge>
        )}
        {project.balancePaid && <Badge variant="default">Balance paid</Badge>}
        {!project.vaultId && <Badge variant="outline">No vault linked</Badge>}
      </div>

      {next && (
        <Button size="sm" variant="outline" disabled={isPending} onClick={() => advance(next.to)}>
          {isPending ? <Loader2 className="animate-spin" /> : <ArrowRight />}
          {next.label}
        </Button>
      )}

      {project.status === "Staging" &&
        (confirming ? (
          <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-2">
            <p className="text-xs text-muted-foreground">
              {project.balancePaid
                ? "Balance is already paid. This will unlock the Vault."
                : `Charge ${formatCurrency(balanceDue)} to the saved card and unlock the Vault?`}
            </p>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" disabled={isPending} onClick={deliver}>
                {isPending ? <Loader2 className="animate-spin" /> : <PackageCheck />}
                Confirm
              </Button>
              <Button size="sm" variant="ghost" disabled={isPending} onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" onClick={() => setConfirming(true)}>
            <PackageCheck />
            Deliver &amp; Charge
          </Button>
        ))}

      {project.status === "Delivered" && project.deliveredAt && (
        <p className="text-xs text-muted-foreground">
          Delivered {new Date(project.deliveredAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </p>
      )}
    </article>
  )
}

export function ProjectBoard({ projects }: { projects: CommandCenterProject[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map((column) => {
        const items = projects.filter((p) => p.status === column.status)
        return (
          <section
            key={column.status}
            aria-label={column.label}
            className="flex min-h-48 flex-col gap-3 rounded-lg border border-border bg-card p-3"
          >
            <header className="flex items-start justify-between gap-2 px-1">
              <div>
                <h2 className="font-heading text-sm font-medium text-foreground">{column.label}</h2>
                <p className="text-xs text-muted-foreground">{column.hint}</p>
              </div>
              <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-foreground">
                {items.length}
              </span>
            </header>
            {items.length === 0 ? (
              <p className="px-1 py-6 text-center text-xs text-muted-foreground">Nothing here yet.</p>
            ) : (
              items.map((project) => <ProjectCard key={project.id} project={project} />)
            )}
          </section>
        )
      })}
    </div>
  )
}
