"use client"

import { useState } from "react"
import { FolderOpen } from "lucide-react"
import { toast } from "sonner"

import {
  createRosterVaultTeamPhoto,
  deleteRosterVaultTeamPhoto,
  listRosterVaultTeamPhotosAdmin,
} from "@/app/actions/roster-vault"
import { RosterVaultPhotoManager, type RosterPhotoPreview } from "@/components/admin/roster-vault-photo-manager"
import { Button } from "@/components/ui/button"

/** The shared folder every parent on the team sees, independent of any one player. */
export function RosterVaultTeamFolder({ teamId, photoCount }: { teamId: string; photoCount?: number }) {
  const [open, setOpen] = useState(false)
  const [photos, setPhotos] = useState<RosterPhotoPreview[] | null>(null)

  async function toggle() {
    if (open) {
      setOpen(false)
      return
    }
    setOpen(true)
    if (photos) return
    try {
      setPhotos(await listRosterVaultTeamPhotosAdmin(teamId))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load the team folder")
      setOpen(false)
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5" aria-labelledby="roster-team-folder-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="roster-team-folder-heading" className="font-heading text-base font-semibold text-foreground">Shared team folder</h2>
          <p className="mt-1 text-xs text-muted-foreground">Group shots and team-wide photos. Unlock rules follow the billing mode above.</p>
        </div>
        <Button type="button" size="sm" variant={open ? "secondary" : "outline"} onClick={() => void toggle()} aria-expanded={open}>
          <FolderOpen className="size-4" aria-hidden="true" />
          {open ? "Hide folder" : photoCount ? `Manage photos (${photoCount})` : "Manage photos"}
        </Button>
      </div>

      {open ? (
        photos === null ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading team photos…</p>
        ) : (
          <RosterVaultPhotoManager
            ownerKey={`team-${teamId}`}
            storagePrefix={`teams/${teamId}`}
            heading="Team folder images"
            photos={photos}
            onPhotosChange={setPhotos}
            createRecord={(input) => createRosterVaultTeamPhoto({ teamId, ...input })}
            deleteRecord={deleteRosterVaultTeamPhoto}
            reload={() => listRosterVaultTeamPhotosAdmin(teamId)}
          />
        )
      ) : null}
    </section>
  )
}
