"use client"

import { useState } from "react"
import { PenLine } from "lucide-react"
import { toast } from "sonner"

import { countersignShoot, type Shoot } from "@/app/actions/shoots"
import { Button } from "@/components/ui/button"

interface CountersignAlertProps {
  shoots: Shoot[]
  onOpen: (shoot: Shoot) => void
  onCountersigned: (shoot: Shoot) => void
}

export function pendingCountersigns(shoots: Shoot[]) {
  return shoots.filter((s) => s.vault_requires_countersign && !s.vault_countersigned_at)
}

export function CountersignAlert({ shoots, onOpen, onCountersigned }: CountersignAlertProps) {
  const [pendingId, setPendingId] = useState<string | null>(null)
  const waiting = pendingCountersigns(shoots)

  if (waiting.length === 0) return null

  async function handleCountersign(shoot: Shoot) {
    setPendingId(shoot.id)
    try {
      const updated = await countersignShoot(shoot.id)
      onCountersigned(updated)
      toast.success(`Countersigned ${shoot.client_name}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not countersign")
    } finally {
      setPendingId(null)
    }
  }

  return (
    <section
      role="alert"
      aria-label="Agreements awaiting countersignature"
      className="flex flex-col gap-3 rounded-xl border border-primary/40 bg-primary/10 p-4"
    >
      <div className="flex items-center gap-2">
        <PenLine className="size-4 text-primary" aria-hidden="true" />
        <h2 className="font-heading text-sm font-medium text-foreground">
          {waiting.length === 1
            ? "1 signed agreement needs your countersignature"
            : `${waiting.length} signed agreements need your countersignature`}
        </h2>
      </div>
      <ul className="flex flex-col gap-2">
        {waiting.map((shoot) => (
          <li
            key={shoot.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-background/60 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{shoot.client_name}</p>
              <p className="text-xs text-muted-foreground">
                {shoot.shoot_type}
                {shoot.vault_client_signed_at
                  ? ` · signed ${new Date(shoot.vault_client_signed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                  : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => onOpen(shoot)}>
                Review
              </Button>
              <Button type="button" size="sm" disabled={pendingId === shoot.id} onClick={() => handleCountersign(shoot)}>
                {pendingId === shoot.id ? "Countersigning..." : "Countersign"}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
