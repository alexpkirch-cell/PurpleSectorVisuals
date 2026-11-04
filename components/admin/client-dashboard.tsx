"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import type { BookingAddon, BookingTier } from "@/app/actions/booking-config"
import type { Shoot } from "@/app/actions/shoots"
import { ClientCard } from "@/components/admin/client-card"
import { ShootWorkspace } from "@/components/admin/shoot-workspace"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { STATUS_LABELS } from "@/lib/operations"

function formatDate(value: string | null) {
  if (!value) return "Not scheduled"
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
}

function amountOf(shoot: Shoot) {
  if (shoot.is_comped) return 0
  return Number(shoot.total_price ?? shoot.final_amount ?? shoot.base_price ?? 0) || 0
}

/** Unified CRM view: the Client Card on top and every shoot as an expandable, fully working workspace. */
export function ClientDashboard({
  clientKey,
  client,
  relationshipNotes,
  initialShoots,
  bookingTiers,
  bookingAddons,
}: {
  clientKey: string
  client: { name: string; email: string; phone: string | null }
  relationshipNotes: string
  initialShoots: Shoot[]
  bookingTiers: BookingTier[]
  bookingAddons: BookingAddon[]
}) {
  const router = useRouter()
  const [shoots, setShoots] = useState(initialShoots)
  const [contactVersion, setContactVersion] = useState(0)
  const [openIds, setOpenIds] = useState<string[]>(initialShoots[0] ? [initialShoots[0].id] : [])

  const lifetimeSpend = useMemo(() => shoots.reduce((sum, shoot) => sum + amountOf(shoot), 0), [shoots])

  function handleShootChange(next: Shoot) {
    setShoots((current) => current.map((shoot) => (shoot.id === next.id ? next : shoot)))
  }

  function handleContactSaved(saved: { key: string; name: string; email: string; phone: string | null }) {
    setShoots((current) =>
      current.map((shoot) => ({ ...shoot, client_name: saved.name, client_email: saved.email, client_phone: saved.phone }))
    )
    // Reopen the workspaces with the new contact details so none of them holds a stale copy.
    setContactVersion((version) => version + 1)
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
          <p className="text-xs text-muted-foreground">Expand a shoot to manage everything for it right here.</p>
        </div>

        <Accordion multiple value={openIds} onValueChange={(value) => setOpenIds(value as string[])} className="gap-3">
          {shoots.map((shoot) => (
            <AccordionItem
              key={shoot.id}
              value={shoot.id}
              className="overflow-hidden rounded-xl border border-border bg-card/40"
            >
              <AccordionTrigger className="items-center rounded-none border-0 px-4 py-3 hover:bg-accent/30 hover:no-underline">
                <span className="grid flex-1 grid-cols-2 items-center gap-x-4 gap-y-2 pr-3 sm:grid-cols-4">
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[0.65rem] tracking-wide text-muted-foreground uppercase">Shoot</span>
                    <span className="text-sm font-medium text-foreground">{shoot.shoot_type}</span>
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[0.65rem] tracking-wide text-muted-foreground uppercase">Date</span>
                    <span className="text-sm text-foreground">{formatDate(shoot.shoot_date)}</span>
                  </span>
                  <span className="flex flex-col items-start gap-0.5">
                    <span className="text-[0.65rem] tracking-wide text-muted-foreground uppercase">Stage</span>
                    <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                      {STATUS_LABELS[shoot.status] ?? shoot.status}
                    </Badge>
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[0.65rem] tracking-wide text-muted-foreground uppercase">Vault PIN</span>
                    <span className="font-mono text-sm tracking-widest text-foreground">{shoot.vault_pin ?? "Not created"}</span>
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="border-t border-border px-4 py-5">
                <ShootWorkspace
                  key={`${shoot.id}-${contactVersion}`}
                  embedded
                  initialShoot={shoot}
                  bookingTiers={bookingTiers}
                  bookingAddons={bookingAddons}
                  onChange={handleShootChange}
                />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </div>
  )
}
