"use client"

import { useEffect, useState } from "react"
import { Calendar, KeyRound, MoreVertical, Trash2, User, XCircle } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { declineShoot, deleteShoot, moveShootStage, type Shoot, type ShootStatus } from "@/app/actions/shoots"
import type { BookingAddon, BookingTier } from "@/app/actions/booking-config"
import { ShootPayoutBadge } from "@/components/admin/shoot-payout-badge"
import { ShootDetailSheet } from "@/components/admin/shoot-detail-sheet"
import { ClientDetailSheet } from "@/components/admin/client-detail-sheet"
import { SettlementModal } from "@/components/admin/settlement-modal"
import { GenerateVaultModal } from "@/components/admin/generate-vault-modal"
import { createMockTestLead, isMockShoot } from "@/lib/mock-lead"

const COLUMNS: { status: ShootStatus; label: string }[] = [
  { status: "new_inquiry", label: "New Inquiries" },
  { status: "quoted", label: "Quoted" },
  { status: "awaiting_retainer", label: "Awaiting Retainer" },
  { status: "booked_scheduled", label: "Booked & Scheduled" },
  { status: "in_post_production", label: "In Post-Production" },
  { status: "vault_locked", label: "Vault Locked" },
  { status: "pending_balance", label: "Pending Balance" },
  { status: "fulfilled", label: "Fulfilled" },
]

function formatDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
}

const VAULT_STATUS_STYLES: Record<string, string> = {
  Onboarding: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  Active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  Expired: "border-muted-foreground/20 bg-muted text-muted-foreground",
}

export function PipelineBoard({
  initialShoots,
  bookingTiers,
  bookingAddons,
}: {
  initialShoots: Shoot[]
  bookingTiers: BookingTier[]
  bookingAddons: BookingAddon[]
}) {
  const [shoots, setShoots] = useState<Shoot[]>(initialShoots)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverStatus, setDragOverStatus] = useState<ShootStatus | null>(null)
  const [selectedShoot, setSelectedShoot] = useState<Shoot | null>(null)
  const [settlingShoot, setSettlingShoot] = useState<Shoot | null>(null)
  const [generatingVaultShoot, setGeneratingVaultShoot] = useState<Shoot | null>(null)
  const [deletingShoot, setDeletingShoot] = useState<Shoot | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Add the demo lead only after mount so the server-rendered markup and the
  // initial client render match exactly (its date is computed from `new Date()`,
  // which would otherwise differ between the SSR pass and hydration).
  useEffect(() => {
    setShoots((current) => (current.some((s) => isMockShoot(s.id)) ? current : [...current, createMockTestLead()]))
  }, [])

  async function moveCard(id: string, status: ShootStatus) {
    const previous = shoots
    setShoots((current) => current.map((s) => (s.id === id ? { ...s, status } : s)))
    if (isMockShoot(id)) return
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

    if (isMockShoot(shoot.id) && (status === "awaiting_retainer" || status === "fulfilled")) {
      toast.info("Open the test lead and use \u201cConfirm Lead & Generate Vault\u201d to preview the CRM flow.")
      return
    }

    if (status === "fulfilled") {
      setSettlingShoot(shoot)
      return
    }

    if (status === "awaiting_retainer") {
      setGeneratingVaultShoot(shoot)
      return
    }

    moveCard(shoot.id, status)
  }

  function handleShootUpdated(updated: Shoot) {
    setShoots((current) => current.map((s) => (s.id === updated.id ? updated : s)))
    setSelectedShoot(updated)
  }

  function handleBookingFinalized(updated: Shoot) {
    setShoots((current) => current.map((s) => (s.id === updated.id ? updated : s)))
    setSelectedShoot(null)
  }

  function handleSettlementFinalized(updated: Shoot) {
    setShoots((current) => current.map((s) => (s.id === updated.id ? updated : s)))
    setSettlingShoot(null)
  }

  function handleVaultGenerated(updated: Shoot) {
    setShoots((current) => current.map((s) => (s.id === updated.id ? updated : s)))
    setGeneratingVaultShoot(null)
  }

  async function handleDecline(shoot: Shoot) {
    const previous = shoots
    setShoots((current) => current.map((s) => (s.id === shoot.id ? { ...s, status: "declined" } : s)))
    if (selectedShoot?.id === shoot.id) setSelectedShoot(null)
    if (isMockShoot(shoot.id)) return
    try {
      await declineShoot(shoot.id)
      toast.success(`${shoot.client_name} declined`)
    } catch (error) {
      setShoots(previous)
      toast.error(error instanceof Error ? error.message : "Failed to decline shoot")
    }
  }

  async function handleDelete() {
    if (!deletingShoot) return
    const shoot = deletingShoot
    setIsDeleting(true)
    try {
      if (!isMockShoot(shoot.id)) {
        await deleteShoot(shoot.id)
      }
      setShoots((current) => current.filter((s) => s.id !== shoot.id))
      if (selectedShoot?.id === shoot.id) setSelectedShoot(null)
      toast.success(`${shoot.client_name} deleted`)
      setDeletingShoot(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete shoot")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-2">
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
                "flex min-h-40 w-72 shrink-0 flex-col gap-2 rounded-lg border p-2.5 transition-colors " +
                (isDragOver ? "border-primary bg-primary/5" : "border-zinc-800 bg-zinc-900/30")
              }
            >
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-semibold tracking-wide text-zinc-300">{column.label}</h3>
                <span className="text-xs text-zinc-500">{columnShoots.length}</span>
              </div>

              {columnShoots.length === 0 ? (
                <p className="px-1 py-4 text-center text-xs text-zinc-500">No shoots</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {columnShoots.map((shoot) => (
                    <div
                      key={shoot.id}
                      role="button"
                      tabIndex={0}
                      draggable
                      onDragStart={() => setDraggingId(shoot.id)}
                      onDragEnd={() => setDraggingId(null)}
                      onClick={() => setSelectedShoot(shoot)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") setSelectedShoot(shoot)
                      }}
                      className={
                        "group relative flex cursor-grab flex-col gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 p-2.5 pr-7 text-left shadow-sm backdrop-blur-md transition-colors active:cursor-grabbing " +
                        (draggingId === shoot.id ? "opacity-50" : "")
                      }
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <button
                              type="button"
                              aria-label={`Actions for ${shoot.client_name}`}
                              onClick={(e) => e.stopPropagation()}
                              className="flex size-6 shrink-0 items-center justify-center rounded-md text-zinc-500 opacity-0 transition-colors group-hover:opacity-100 hover:bg-zinc-800 hover:text-zinc-100 data-open:opacity-100"
                            />
                          }
                        >
                          <MoreVertical className="size-3.5" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem onSelect={() => handleDecline(shoot)}>
                            <XCircle className="size-3.5" />
                            Decline
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setDeletingShoot(shoot)}
                          >
                            <Trash2 className="size-3.5" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <p className="text-sm font-medium text-zinc-100">{shoot.client_name}</p>

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
                        <span className="flex items-center gap-1 text-sm text-zinc-400">
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

                      {column.status === "quoted" && (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="mt-1 h-7 w-full text-[0.7rem]"
                          onClick={(e) => {
                            e.stopPropagation()
                            setGeneratingVaultShoot(shoot)
                          }}
                        >
                          Generate Vault & Send Link
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <ClientDetailSheet
        shoot={selectedShoot?.status === "new_inquiry" ? selectedShoot : null}
        bookingTiers={bookingTiers}
        bookingAddons={bookingAddons}
        onOpenChange={(open) => !open && setSelectedShoot(null)}
        onFinalized={handleBookingFinalized}
      />

      <ShootDetailSheet
        shoot={selectedShoot?.status === "new_inquiry" ? null : selectedShoot}
        bookingTiers={bookingTiers}
        bookingAddons={bookingAddons}
        onOpenChange={(open) => !open && setSelectedShoot(null)}
        onUpdated={handleShootUpdated}
        onDeclined={handleDecline}
        onDeleteRequested={setDeletingShoot}
      />

      <SettlementModal
        shoot={settlingShoot}
        onOpenChange={(open) => !open && setSettlingShoot(null)}
        onFinalized={handleSettlementFinalized}
      />

      <GenerateVaultModal
        shoot={generatingVaultShoot}
        onOpenChange={(open) => !open && setGeneratingVaultShoot(null)}
        onGenerated={handleVaultGenerated}
      />

      <AlertDialog open={!!deletingShoot} onOpenChange={(open) => !open && setDeletingShoot(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deletingShoot?.client_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure? This cannot be undone. This permanently deletes the shoot, its vault, and all
              associated records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
