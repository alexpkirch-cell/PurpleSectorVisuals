"use client"

import { useState } from "react"
import { Calendar, KeyRound, User } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { moveShootStage, type Shoot, type ShootStatus } from "@/app/actions/shoots"
import { ShootPayoutBadge } from "@/components/admin/shoot-payout-badge"
import { ShootDetailSheet } from "@/components/admin/shoot-detail-sheet"
import { SettlementModal } from "@/components/admin/settlement-modal"

const COLUMNS: { status: ShootStatus; label: string }[] = [
  { status: "new_inquiry", label: "New Inquiry" },
  { status: "contacted", label: "Contacted" },
  { status: "shoot_scheduled", label: "Shoot Scheduled" },
  { status: "editing", label: "Editing" },
  { status: "vault_created", label: "Vault Created" },
  { status: "sent_finished", label: "Sent / Finished" },
]

function formatDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

const VAULT_STATUS_STYLES: Record<string, string> = {
  Onboarding: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  Active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  Expired: "border-muted-foreground/20 bg-muted text-muted-foreground",
}

export function PipelineBoard({ initialShoots }: { initialShoots: Shoot[] }) {
  const [shoots, setShoots] = useState(initialShoots)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverStatus, setDragOverStatus] = useState<ShootStatus | null>(null)
  const [selectedShoot, setSelectedShoot] = useState<Shoot | null>(null)
  const [settlingShoot, setSettlingShoot] = useState<Shoot | null>(null)

  async function moveCard(id: string, status: ShootStatus) {
    const previous = shoots
    setShoots((current) => current.map((s) => (s.id === id ? { ...s, status } : s)))
    try {
      await moveShootStage(id, status)
    } catch (error) {
      setShoots(previous)
      toast.error(error instanceof Error ? error.message : "Failed to move shoot")
    }
  }

  function handleDrop(status: ShootStatus) {
    if (!draggingId) return
    const shoot = shoots.find((s) => s.id === draggingId)
    setDraggingId(null)
    if (!shoot) return

    if (status === "sent_finished") {
      setSettlingShoot(shoot)
      return
    }

    moveCard(shoot.id, status)
  }

  function handleShootUpdated(updated: Shoot) {
    setShoots((current) => current.map((s) => (s.id === updated.id ? updated : s)))
    setSelectedShoot(updated)
  }

  function handleSettlementFinalized(updated: Shoot) {
    setShoots((current) => current.map((s) => (s.id === updated.id ? updated : s)))
    setSettlingShoot(null)
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {COLUMNS.map((column) => {
          const columnShoots = shoots.filter((s) => s.status === column.status)
          const isDragOver = dragOverStatus === column.status
          return (
            <div
              key={column.status}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOverStatus(column.status)
              }}
              onDragLeave={() => setDragOverStatus((current) => (current === column.status ? null : current))}
              onDrop={(e) => {
                e.preventDefault()
                setDragOverStatus(null)
                handleDrop(column.status)
              }}
              className={
                "flex min-h-40 flex-col gap-2 rounded-lg border p-2.5 transition-colors " +
                (isDragOver ? "border-primary bg-primary/5" : "border-border bg-accent/20")
              }
            >
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-semibold tracking-wide text-foreground">{column.label}</h3>
                <span className="text-xs text-muted-foreground">{columnShoots.length}</span>
              </div>

              {columnShoots.length === 0 ? (
                <p className="px-1 py-4 text-center text-xs text-muted-foreground">No shoots</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {columnShoots.map((shoot) => (
                    <button
                      key={shoot.id}
                      type="button"
                      draggable
                      onDragStart={() => setDraggingId(shoot.id)}
                      onDragEnd={() => setDraggingId(null)}
                      onClick={() => setSelectedShoot(shoot)}
                      className={
                        "group flex cursor-grab flex-col gap-1.5 rounded-md border border-border bg-card p-2.5 text-left shadow-sm active:cursor-grabbing " +
                        (draggingId === shoot.id ? "opacity-50" : "")
                      }
                    >
                      <p className="text-sm font-medium text-foreground">{shoot.client_name}</p>

                      <div className="flex flex-wrap gap-1">
                        <Badge variant="secondary" className="text-[0.6rem]">
                          {shoot.shoot_type}
                        </Badge>
                        {shoot.preferred_shooter && (
                          <Badge variant="outline" className="gap-1 text-[0.6rem]">
                            <User className="size-2.5" />
                            {shoot.preferred_shooter}
                          </Badge>
                        )}
                      </div>

                      {shoot.shoot_date && (
                        <span className="flex items-center gap-1 text-[0.7rem] text-muted-foreground">
                          <Calendar className="size-3 shrink-0" />
                          {formatDate(shoot.shoot_date)}
                        </span>
                      )}

                      {shoot.vault_status && (
                        <Badge
                          variant="outline"
                          className={
                            "w-fit gap-1 text-[0.6rem] " +
                            (VAULT_STATUS_STYLES[shoot.vault_status] ?? "")
                          }
                        >
                          <KeyRound className="size-2.5" />
                          Vault: {shoot.vault_status}
                        </Badge>
                      )}

                      <ShootPayoutBadge
                        basePrice={Number(shoot.base_price)}
                        travelFee={Number(shoot.travel_fee)}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <ShootDetailSheet
        shoot={selectedShoot}
        onOpenChange={(open) => !open && setSelectedShoot(null)}
        onUpdated={handleShootUpdated}
      />

      <SettlementModal
        shoot={settlingShoot}
        onOpenChange={(open) => !open && setSettlingShoot(null)}
        onFinalized={handleSettlementFinalized}
      />
    </>
  )
}
