"use client"

import { useState } from "react"
import { FolderOpen } from "lucide-react"
import { toast } from "sonner"

import {
  createRosterVaultPlayerPhoto,
  createRosterVaultTeamPhoto,
  deleteRosterVaultPlayerPhoto,
  deleteRosterVaultTeamPhoto,
  listRosterVaultPhotosAdmin,
  listRosterVaultTeamPhotosAdmin,
} from "@/app/actions/roster-vault"
import { RosterVaultPhotoManager, type RosterPhotoPreview } from "@/components/admin/roster-vault-photo-manager"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

const selectClass = "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground focus-visible:border-ring focus-visible:outline-none"

type UploadTarget = "team" | string

/** Shared-team uploads can stay in the main folder or be quickly tagged to one player. */
export function RosterVaultTeamFolder({
  teamId,
  photoCount,
  players,
}: {
  teamId: string
  photoCount?: number
  players: { id: string; display_name: string }[]
}) {
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState<UploadTarget>("team")
  const [photos, setPhotos] = useState<RosterPhotoPreview[] | null>(null)

  const selectedPlayer = players.find((player) => player.id === target) ?? null
  const ownerKey = selectedPlayer ? `player-${selectedPlayer.id}` : `team-${teamId}`
  const storagePrefix = selectedPlayer ? selectedPlayer.id : `teams/${teamId}`
  const targetTitle = selectedPlayer ? `${selectedPlayer.display_name} player gallery` : "Shared team folder"

  async function loadTarget(nextTarget: UploadTarget) {
    setPhotos(null)
    try {
      const rows = nextTarget === "team"
        ? await listRosterVaultTeamPhotosAdmin(teamId)
        : await listRosterVaultPhotosAdmin(nextTarget)
      setPhotos(rows)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load gallery photos")
    }
  }

  async function toggle() {
    if (open) {
      setOpen(false)
      return
    }
    setOpen(true)
    if (photos) return
    await loadTarget(target)
  }

  function changeTarget(nextTarget: UploadTarget) {
    setTarget(nextTarget)
    void loadTarget(nextTarget)
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5" aria-labelledby="roster-team-folder-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="roster-team-folder-heading" className="font-heading text-base font-semibold text-foreground">Shared team folder</h2>
          <p className="mt-1 text-xs text-muted-foreground">Drop images into the shared folder or select a player to quick-tag them during upload. Download rules follow the billing mode above.</p>
        </div>
        <Button type="button" size="sm" variant={open ? "secondary" : "outline"} onClick={() => void toggle()} aria-expanded={open}>
          <FolderOpen data-icon="inline-start" />
          {open ? "Hide uploader" : photoCount ? `Manage photos (${photoCount})` : "Upload photos"}
        </Button>
      </div>

      {open ? (
        <div className="flex flex-col gap-4">
          <div className="flex max-w-sm flex-col gap-1.5">
            <Label htmlFor={`team-photo-target-${teamId}`}>Upload destination / quick tag</Label>
            <select id={`team-photo-target-${teamId}`} value={target} onChange={(event) => changeTarget(event.target.value)} className={selectClass}>
              <option value="team">Shared team folder</option>
              {players.map((player) => <option key={player.id} value={player.id}>{player.display_name}</option>)}
            </select>
          </div>
          {photos === null ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading {targetTitle.toLowerCase()}…</p>
          ) : (
            <RosterVaultPhotoManager
              key={ownerKey}
              ownerKey={ownerKey}
              storagePrefix={storagePrefix}
              heading={selectedPlayer ? `${selectedPlayer.display_name} gallery images` : "Shared team folder images"}
              photos={photos}
              onPhotosChange={setPhotos}
              createRecord={(input) => selectedPlayer
                ? createRosterVaultPlayerPhoto({ playerId: selectedPlayer.id, ...input })
                : createRosterVaultTeamPhoto({ teamId, ...input })}
              deleteRecord={selectedPlayer ? deleteRosterVaultPlayerPhoto : deleteRosterVaultTeamPhoto}
              reload={() => selectedPlayer ? listRosterVaultPhotosAdmin(selectedPlayer.id) : listRosterVaultTeamPhotosAdmin(teamId)}
            />
          )}
        </div>
      ) : null}
    </section>
  )
}
