"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, ExternalLink } from "lucide-react"

import type { Shoot } from "@/app/actions/shoots"
import { ClientCard } from "@/components/admin/client-card"
import { ShootDetailSheet } from "@/components/admin/shoot-detail-sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { STATUS_LABELS } from "@/lib/operations"

function formatDate(value: string | null) {
  if (!value) return "Not scheduled"
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
}

function amountOf(shoot: Shoot) {
  if (shoot.is_comped) return 0
  return Number(shoot.total_price ?? shoot.final_amount ?? 0) || 0
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
}

/** Unified CRM view: the Client Card on top and every shoot as an expandable, fully working workspace. */
export function ClientDashboard({
  clientKey,
  client,
  relationshipNotes,
  initialShoots,
}: {
  clientKey: string
  client: { name: string; email: string; phone: string | null }
  relationshipNotes: string
  initialShoots: Shoot[]
}) {
  const router = useRouter()
  const [shoots, setShoots] = useState(initialShoots)
  const [workspaceShootId, setWorkspaceShootId] = useState<string | null>(null)

  const lifetimeSpend = useMemo(() => shoots.reduce((sum, shoot) => sum + amountOf(shoot), 0), [shoots])

  function handleShootChange(next: Shoot) {
    setShoots((current) => current.map((shoot) => (shoot.id === next.id ? next : shoot)))
  }

  function handleContactSaved(saved: { key: string; name: string; email: string; phone: string | null }) {
    setShoots((current) =>
      current.map((shoot) => ({ ...shoot, client_name: saved.name, client_email: saved.email, client_phone: saved.phone }))
    )
    // The directory key follows the email, so a changed email means a new address for this page.
    if (saved.key !== clientKey) router.replace(`/admin/clients/${encodeURIComponent(saved.key)}`)
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/clients"
        className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Client Directory
      </Link>

      <ClientCard
        clientKey={clientKey}
        initial={{ name: client.name, email: client.email, phone: client.phone ?? "", relationshipNotes }}
        lifetimeSpend={lifetimeSpend}
        shootCount={shoots.length}
        onSaved={handleContactSaved}
      />

      <section aria-labelledby="client-shoots" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="client-shoots" className="font-heading text-lg font-medium text-foreground">
            Shoots &amp; Workspaces
          </h2>
          <p className="text-xs text-muted-foreground">Open a shoot to view its workspace tabs.</p>
        </div>

        {shoots.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {shoots.map((shoot) => (
              <li key={shoot.id} className="grid items-center gap-3 rounded-xl border border-border bg-card/40 p-4 sm:grid-cols-2 lg:grid-cols-[1.25fr_1fr_1.2fr_1fr_0.8fr_auto]">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Shoot Type</span>
                  <span className="truncate text-sm font-medium text-foreground">{shoot.shoot_type}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Date</span>
                  <span className="text-sm text-foreground">{formatDate(shoot.shoot_date)}</span>
                </div>
                <div className="flex flex-col items-start gap-0.5">
                  <span className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Stage</span>
                  <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                    {STATUS_LABELS[shoot.status] ?? shoot.status}
                  </Badge>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Contract Total</span>
                  <span className="text-sm tabular-nums text-foreground">{formatCurrency(amountOf(shoot))}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Vault PIN</span>
                  <span className="font-mono text-sm tracking-widest text-foreground">{shoot.vault_pin ?? "Not created"}</span>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setWorkspaceShootId(shoot.id)}>
                  Open Shoot Workspace
                  <ExternalLink data-icon="inline-end" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">No shoots are linked to this client yet.</p>
        )}
      </section>

      <ShootDetailSheet
        shoot={shoots.find((item) => item.id === workspaceShootId) ?? null}
        onOpenChange={(open) => !open && setWorkspaceShootId(null)}
        onUpdated={handleShootChange}
      />
    </div>
  )
}
