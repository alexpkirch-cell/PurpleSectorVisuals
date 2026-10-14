"use client"

import { useState } from "react"
import Link from "next/link"
import { ExternalLink, Loader2, Trash2, User } from "lucide-react"
import { toast } from "sonner"

import { deletePhotographer, type RosterContractor } from "@/app/actions/roster"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AddPhotographerDialog } from "./add-photographer-dialog"

export function RosterManager({ initialRoster }: { initialRoster: RosterContractor[] }) {
  const [roster, setRoster] = useState(initialRoster)
  const [pendingDelete, setPendingDelete] = useState<RosterContractor | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await deletePhotographer(pendingDelete.id)
      setRoster((prev) => prev.filter((c) => c.id !== pendingDelete.id))
      toast.success(`${pendingDelete.name} removed from the roster`)
      setPendingDelete(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete photographer")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Each photographer gets a public portfolio page with a Book This Shooter button.
        </p>
        <AddPhotographerDialog onCreated={(contractor) => setRoster((prev) => [...prev, contractor])} />
      </div>

      {roster.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          No photographers yet. Add your first one.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {roster.map((contractor) => (
            <li
              key={contractor.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
            >
              <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground">
                {contractor.profile_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- admin preview of an uploaded public asset
                  <img
                    src={contractor.profile_image_url}
                    alt={contractor.name}
                    crossOrigin="anonymous"
                    className="size-full object-cover"
                  />
                ) : (
                  <User className="size-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{contractor.name}</p>
                <p className="text-xs text-muted-foreground">
                  {contractor.portfolio_image_urls.length} portfolio image
                  {contractor.portfolio_image_urls.length === 1 ? "" : "s"}
                </p>
              </div>
              <Button variant="ghost" size="sm" render={<Link href={`/team/${contractor.id}`} target="_blank" />}>
                <ExternalLink />
                View
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setPendingDelete(contractor)}>
                <Trash2 />
                Delete
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={pendingDelete !== null} onOpenChange={(open) => !open && !deleting && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {pendingDelete?.name}?</DialogTitle>
            <DialogDescription>
              This removes their roster row and uploaded images. It can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting && <Loader2 className="animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
