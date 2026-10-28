"use client"

import { useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { Images, Plus } from "lucide-react"
import { toast } from "sonner"

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
import { Button } from "@/components/ui/button"
import { declineShoot, deleteShoot, moveShootStage, type Shoot } from "@/app/actions/shoots"
import type { BookingAddon, BookingTier } from "@/app/actions/booking-config"
import { ClientDetailSheet } from "@/components/admin/client-detail-sheet"
import { GenerateVaultModal } from "@/components/admin/generate-vault-modal"
import { SettlementModal } from "@/components/admin/settlement-modal"
import { ShootDetailSheet } from "@/components/admin/shoot-detail-sheet"
import { CountersignAlert } from "@/components/admin/operations/countersign-alert"
import { KpiRow } from "@/components/admin/operations/kpi-row"
import { ManualBookingDialog } from "@/components/admin/operations/manual-booking-dialog"
import { PipelineBoard } from "@/components/admin/operations/pipeline-board"
import { RollingCalendar } from "@/components/admin/operations/rolling-calendar"
import { computeKpis, stageForStatus, type PipelineStage } from "@/lib/operations"

interface OperationsDashboardProps {
  initialShoots: Shoot[]
  bookingTiers: BookingTier[]
  bookingAddons: BookingAddon[]
  /** "YYYY-MM" and "YYYY-MM-DD" computed on the server so SSR and hydration agree. */
  monthKey: string
  monthLabel: string
  todayKey: string
  printQueue: ReactNode
}

export function OperationsDashboard({
  initialShoots,
  bookingTiers,
  bookingAddons,
  monthKey,
  monthLabel,
  todayKey,
  printQueue,
}: OperationsDashboardProps) {
  const [shoots, setShoots] = useState<Shoot[]>(initialShoots)
  const [syncedFrom, setSyncedFrom] = useState(initialShoots)
  const [selectedShoot, setSelectedShoot] = useState<Shoot | null>(null)
  const [settlingShoot, setSettlingShoot] = useState<Shoot | null>(null)
  const [generatingVaultShoot, setGeneratingVaultShoot] = useState<Shoot | null>(null)
  const [deletingShoot, setDeletingShoot] = useState<Shoot | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isBookingOpen, setIsBookingOpen] = useState(false)

  // Server revalidation delivers fresh rows; adopt them so the board never drifts from Supabase.
  if (initialShoots !== syncedFrom) {
    setSyncedFrom(initialShoots)
    setShoots(initialShoots)
  }

  const activeShoots = useMemo(() => shoots.filter((s) => s.status !== "declined"), [shoots])
  const kpis = useMemo(() => computeKpis(activeShoots, monthKey), [activeShoots, monthKey])

  function replaceShoot(updated: Shoot) {
    setShoots((current) => current.map((s) => (s.id === updated.id ? updated : s)))
  }

  async function moveCard(shoot: Shoot, stage: PipelineStage) {
    const previous = shoots
    setShoots((current) => current.map((s) => (s.id === shoot.id ? { ...s, status: stage.dropStatus } : s)))
    try {
      await moveShootStage(shoot.id, stage.dropStatus)
    } catch (error) {
      setShoots(previous)
      toast.error(error instanceof Error ? error.message : "Failed to move shoot")
    }
  }

  function handleMove(shoot: Shoot, stage: PipelineStage) {
    if (stageForStatus(shoot.status)?.id === stage.id) return
    // Finishing a shoot requires an itemized settlement before it can be marked fulfilled.
    if (stage.dropStatus === "fulfilled") {
      setSettlingShoot(shoot)
      return
    }
    void moveCard(shoot, stage)
  }

  async function handleDecline(shoot: Shoot) {
    const previous = shoots
    setShoots((current) => current.map((s) => (s.id === shoot.id ? { ...s, status: "declined" } : s)))
    if (selectedShoot?.id === shoot.id) setSelectedShoot(null)
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
      await deleteShoot(shoot.id)
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
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-medium text-foreground">Operations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every lead and shoot, from first inquiry to vault delivery.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => setIsBookingOpen(true)}>
            <Plus className="size-4" />
            Manual Booking
          </Button>
          <Button variant="outline" render={<Link href="/admin/vaults" />} nativeButton={false}>
            <Images className="size-4" />
            Manage Vaults
          </Button>
        </div>
      </header>

      <CountersignAlert shoots={activeShoots} onOpen={setSelectedShoot} onCountersigned={replaceShoot} />

      <KpiRow kpis={kpis} monthLabel={monthLabel} />

      <PipelineBoard
        shoots={activeShoots}
        onMove={handleMove}
        onOpen={setSelectedShoot}
        onDecline={handleDecline}
        onDelete={setDeletingShoot}
        onGenerateVault={setGeneratingVaultShoot}
      />

      <RollingCalendar shoots={activeShoots} todayKey={todayKey} onOpen={setSelectedShoot} />

      <section aria-labelledby="print-queue-heading" className="flex flex-col gap-3">
        <h2 id="print-queue-heading" className="font-heading text-base font-medium text-foreground">
          Print Fulfillment Queue
        </h2>
        {printQueue}
      </section>

      <ManualBookingDialog
        open={isBookingOpen}
        onOpenChange={setIsBookingOpen}
        onCreated={(shoot) => setShoots((current) => [shoot, ...current])}
      />

      <ClientDetailSheet
        shoot={selectedShoot?.status === "new_inquiry" ? selectedShoot : null}
        bookingTiers={bookingTiers}
        bookingAddons={bookingAddons}
        onOpenChange={(open) => !open && setSelectedShoot(null)}
        onFinalized={(updated) => {
          replaceShoot(updated)
          setSelectedShoot(null)
        }}
      />

      <ShootDetailSheet
        shoot={selectedShoot?.status === "new_inquiry" ? null : selectedShoot}
        bookingTiers={bookingTiers}
        bookingAddons={bookingAddons}
        onOpenChange={(open) => !open && setSelectedShoot(null)}
        onUpdated={(updated) => {
          replaceShoot(updated)
          setSelectedShoot(updated)
        }}
        onDeclined={handleDecline}
        onDeleteRequested={setDeletingShoot}
      />

      <SettlementModal
        shoot={settlingShoot}
        onOpenChange={(open) => !open && setSettlingShoot(null)}
        onFinalized={(updated) => {
          replaceShoot(updated)
          setSettlingShoot(null)
        }}
      />

      <GenerateVaultModal
        shoot={generatingVaultShoot}
        onOpenChange={(open) => !open && setGeneratingVaultShoot(null)}
        onGenerated={(updated) => {
          replaceShoot(updated)
          setGeneratingVaultShoot(null)
        }}
      />

      <AlertDialog open={!!deletingShoot} onOpenChange={(open) => !open && setDeletingShoot(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deletingShoot?.client_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the shoot, its vault, and all associated records. It cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
