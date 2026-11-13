"use client"

import { useMemo, useState, useTransition } from "react"
import { ImagePlus, Images, Pencil, Plus, ShieldCheck, Trash2, Users } from "lucide-react"
import { toast } from "sonner"

import {
  createRosterVaultGalleryTier,
  createRosterVaultPlayer,
  createRosterVaultTeam,
  deleteRosterVaultPlayer,
  listRosterVaultPlayers,
  listRosterVaultPhotosAdmin,
  listRosterVaultTiers,
  updateRosterVaultGalleryTier,
  updateRosterVaultPlayer,
  updateRosterVaultTeam,
  type RosterVaultPhoto,
  type RosterVaultPlayer,
  type RosterVaultTeam,
  type RosterVaultTier,
} from "@/app/actions/roster-vault"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RosterVaultPhotoManager } from "@/components/admin/roster-vault-photo-manager"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

export function RosterVaultManager({
  initialTeams,
  initialPlayers,
  initialTiers,
}: {
  initialTeams: RosterVaultTeam[]
  initialPlayers: RosterVaultPlayer[]
  initialTiers: RosterVaultTier[]
}) {
  const [teams, setTeams] = useState(initialTeams)
  const [selectedId, setSelectedId] = useState<string | null>(initialTeams[0]?.id ?? null)
  const [players, setPlayers] = useState<RosterVaultPlayer[]>(initialPlayers)
  const [playersLoadedFor, setPlayersLoadedFor] = useState<string | null>(initialTeams[0]?.id ?? null)
  const [tiers, setTiers] = useState<RosterVaultTier[]>(initialTiers)
  const [photos, setPhotos] = useState<RosterVaultPhoto[]>([])
  const [photosFor, setPhotosFor] = useState<string | null>(null)
  const [newTeamOpen, setNewTeamOpen] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const selectedTeam = useMemo(() => teams.find((team) => team.id === selectedId) ?? null, [teams, selectedId])

  async function selectTeam(id: string) {
    setSelectedId(id)
    setEditingPlayer(null)
    try {
      const [rows, teamTiers] = await Promise.all([listRosterVaultPlayers(id), listRosterVaultTiers(id)])
      setPlayers(rows)
      setTiers(teamTiers)
      setPlayersLoadedFor(id)
      setPhotosFor(null)
      setPhotos([])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load this roster")
    }
  }

  async function handleCreateTeam(formData: FormData) {
    startTransition(async () => {
      try {
        const team = await createRosterVaultTeam({
          name: String(formData.get("teamName") ?? ""),
          accessCode: String(formData.get("accessCode") ?? ""),
          password: String(formData.get("teamPassword") ?? ""),
        })
        setTeams((current) => [team, ...current])
        setPlayers([])
        setPlayersLoadedFor(team.id)
        setTiers([])
        setSelectedId(team.id)
        setNewTeamOpen(false)
        toast.success("Team created. Access credentials are stored securely.")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not create team")
      }
    })
  }

  async function handleTeamUpdate(formData: FormData) {
    if (!selectedTeam) return
    startTransition(async () => {
      try {
        const isActive = formData.get("isActive") === "on"
        await updateRosterVaultTeam({
          id: selectedTeam.id,
          name: String(formData.get("name") ?? ""),
          isActive,
          accessCode: String(formData.get("newAccessCode") ?? "") || undefined,
          password: String(formData.get("newPassword") ?? "") || undefined,
        })
        setTeams((current) => current.map((team) => team.id === selectedTeam.id ? { ...team, name: String(formData.get("name") ?? "").trim(), is_active: isActive } : team))
        toast.success("Team settings saved")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not save team settings")
      }
    })
  }

  async function handleCreateTier(formData: FormData) {
    if (!selectedTeam) return
    startTransition(async () => {
      try {
        const tier = await createRosterVaultGalleryTier({
          teamId: selectedTeam.id,
          name: String(formData.get("tierName") ?? ""),
          priceCents: Math.round(Number(formData.get("priceUsd")) * 100),
        })
        setTiers((current) => [...current, tier].sort((a, b) => a.price_cents - b.price_cents))
        toast.success("Gallery tier created")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not create tier")
      }
    })
  }

  async function handleUpdateTier(tier: RosterVaultTier, formData: FormData) {
    startTransition(async () => {
      try {
        const updated = {
          ...tier,
          name: String(formData.get("tierName") ?? "").trim(),
          price_cents: Math.round(Number(formData.get("priceUsd")) * 100),
          is_active: formData.get("isActive") === "on",
        }
        await updateRosterVaultGalleryTier({
          id: tier.id,
          name: updated.name,
          priceCents: updated.price_cents,
          isActive: updated.is_active,
        })
        setTiers((current) => current.map((item) => item.id === tier.id ? updated : item))
        setPlayers((current) => current.map((player) => player.tier_id === tier.id ? {
          ...player,
          tier_name: updated.is_active ? updated.name : null,
          tier_price_cents: updated.is_active ? updated.price_cents : null,
        } : player))
        toast.success("Tier pricing saved")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not save tier")
      }
    })
  }

  async function openPlayerPhotos(playerId: string) {
    if (photosFor === playerId) {
      setPhotosFor(null)
      return
    }
    setPhotosFor(playerId)
    setPhotos([])
    try {
      setPhotos(await listRosterVaultPhotosAdmin(playerId))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load gallery photos")
    }
  }

  async function handleAddPlayer(formData: FormData) {
    if (!selectedTeam) return
    startTransition(async () => {
      try {
        await createRosterVaultPlayer({
          teamId: selectedTeam.id,
          displayName: String(formData.get("displayName") ?? ""),
          jerseyNumber: String(formData.get("jerseyNumber") ?? ""),
          coverImageUrl: String(formData.get("coverImageUrl") ?? ""),
          tierId: String(formData.get("tierId") ?? "") || null,
        })
        const rows = await listRosterVaultPlayers(selectedTeam.id)
        setPlayers(rows)
        toast.success("Player added to the roster")
        ;(document.getElementById("roster-player-form") as HTMLFormElement | null)?.reset()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not add player")
      }
    })
  }

  async function handleUpdatePlayer(player: RosterVaultPlayer, formData: FormData) {
    startTransition(async () => {
      try {
        const tierId = String(formData.get("tierId") ?? "") || null
        const selectedTier = tiers.find((tier) => tier.id === tierId) ?? null
        const updated = {
          ...player,
          display_name: String(formData.get("displayName") ?? "").trim(),
          jersey_number: String(formData.get("jerseyNumber") ?? "").trim(),
          cover_image_url: String(formData.get("coverImageUrl") ?? "").trim() || null,
          tier_id: tierId,
          tier_name: selectedTier?.name ?? null,
          tier_price_cents: selectedTier?.price_cents ?? null,
          is_active: formData.get("isActive") === "on",
        }
        await updateRosterVaultPlayer({
          id: player.id,
          displayName: updated.display_name,
          jerseyNumber: updated.jersey_number,
          coverImageUrl: updated.cover_image_url ?? "",
          tierId: updated.tier_id,
          isActive: updated.is_active,
        })
        setPlayers((current) => current.map((item) => item.id === player.id ? updated : item))
        setEditingPlayer(null)
        toast.success("Player updated")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not update player")
      }
    })
  }

  async function handleDeletePlayer(player: RosterVaultPlayer) {
    startTransition(async () => {
      try {
        await deleteRosterVaultPlayer(player.id)
        setPlayers((current) => current.filter((item) => item.id !== player.id))
        toast.success(`${player.display_name} removed`)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not remove player")
      }
    })
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[17rem_minmax(0,1fr)]">
      <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4" aria-labelledby="roster-vault-teams-heading">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 id="roster-vault-teams-heading" className="font-heading text-base font-semibold text-foreground">Teams</h2>
            <p className="text-xs text-muted-foreground">{teams.length} media day{teams.length === 1 ? "" : "s"}</p>
          </div>
          <Button type="button" size="icon-sm" onClick={() => setNewTeamOpen(true)} aria-label="Create team">
            <Plus className="size-4" aria-hidden="true" />
          </Button>
        </div>

        {teams.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <Users className="mx-auto mb-2 size-5 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">No teams yet. Create a media day to begin.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {teams.map((team) => (
              <li key={team.id}>
                <button
                  type="button"
                  onClick={() => void selectTeam(team.id)}
                  aria-pressed={selectedId === team.id}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                    selectedId === team.id ? "border-primary/50 bg-primary/10 text-foreground" : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{team.name}</span>
                    <span className="block text-xs text-muted-foreground">{team.player_count} player{team.player_count === 1 ? "" : "s"}</span>
                  </span>
                  {!team.is_active ? <span className="text-[10px] uppercase tracking-wide text-amber-500">Paused</span> : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selectedTeam ? (
        <div className="flex min-w-0 flex-col gap-5">
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
              <h2 className="font-heading text-base font-semibold text-foreground">{selectedTeam.name} access</h2>
            </div>
            <form action={handleTeamUpdate} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="roster-team-name">Team name</Label>
                <Input id="roster-team-name" name="name" defaultValue={selectedTeam.name} required maxLength={100} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="roster-new-code">Replace access code</Label>
                <Input id="roster-new-code" name="newAccessCode" placeholder="Leave blank to keep" autoComplete="off" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="roster-new-password">Replace password</Label>
                <Input id="roster-new-password" name="newPassword" type="password" placeholder="Leave blank to keep" autoComplete="new-password" />
              </div>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <label className="flex h-9 items-center gap-2 text-sm text-muted-foreground">
                  <input type="checkbox" name="isActive" defaultChecked={selectedTeam.is_active} className="accent-primary" />
                  Access enabled
                </label>
                <Button type="submit" size="sm" disabled={pending}>Save settings</Button>
              </div>
            </form>
            <p className="mt-3 text-xs text-muted-foreground">Access codes and passwords are hashed and cannot be viewed here. Replacing either immediately changes the team login.</p>
          </section>

          <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5" aria-labelledby="gallery-tiers-heading">
            <div>
              <h2 id="gallery-tiers-heading" className="font-heading text-base font-semibold text-foreground">Gallery pricing tiers</h2>
              <p className="mt-1 text-xs text-muted-foreground">Each player is assigned one tier. Checkout prices are read from here on the server.</p>
            </div>
            <form action={handleCreateTier} className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
              <div className="flex flex-col gap-1.5"><Label htmlFor="new-gallery-tier">Tier name</Label><Input id="new-gallery-tier" name="tierName" placeholder="Standard" maxLength={60} required /></div>
              <div className="flex flex-col gap-1.5"><Label htmlFor="new-gallery-price">Price (USD)</Label><Input id="new-gallery-price" name="priceUsd" type="number" min="1" max="100000" step="0.01" placeholder="39.00" required /></div>
              <Button type="submit" disabled={pending}><Plus className="size-4" aria-hidden="true" /> Add tier</Button>
            </form>
            {tiers.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">Create a price tier, then assign it to players to enable checkout.</p>
            ) : (
              <ul className="grid gap-2">
                {tiers.map((tier) => (
                  <li key={tier.id} className="rounded-lg border border-border bg-background/50 p-3">
                    <form action={(formData) => handleUpdateTier(tier, formData)} className="grid gap-3 sm:grid-cols-[1fr_10rem_auto_auto] sm:items-end">
                      <div className="flex flex-col gap-1.5"><Label htmlFor={`tier-name-${tier.id}`}>Tier</Label><Input id={`tier-name-${tier.id}`} name="tierName" defaultValue={tier.name} required maxLength={60} /></div>
                      <div className="flex flex-col gap-1.5"><Label htmlFor={`tier-price-${tier.id}`}>Price (USD)</Label><Input id={`tier-price-${tier.id}`} name="priceUsd" type="number" min="1" max="100000" step="0.01" defaultValue={(tier.price_cents / 100).toFixed(2)} required /></div>
                      <label className="flex h-9 items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" name="isActive" defaultChecked={tier.is_active} className="accent-primary" /> Available</label>
                      <Button type="submit" size="sm" variant="outline" disabled={pending}>Save</Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5" aria-labelledby="roster-players-heading">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 id="roster-players-heading" className="font-heading text-base font-semibold text-foreground">Player roster</h2>
                <p className="text-xs text-muted-foreground">Name, jersey number and an optional square cover image.</p>
              </div>
              <span className="font-mono text-xs text-muted-foreground">{players.length} total</span>
            </div>

            <form id="roster-player-form" action={handleAddPlayer} className="grid gap-3 rounded-lg border border-dashed border-border p-4 sm:grid-cols-[1fr_8rem_1fr_1.4fr_auto] sm:items-end">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-player-name">Player name</Label>
                <Input id="new-player-name" name="displayName" placeholder="Full name" maxLength={100} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-player-number">Jersey number</Label>
                <Input id="new-player-number" name="jerseyNumber" placeholder="24" maxLength={12} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-player-tier">Gallery tier</Label>
                <select id="new-player-tier" name="tierId" defaultValue="" className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground focus-visible:border-ring focus-visible:outline-none disabled:opacity-50">
                  <option value="">Not assigned</option>
                  {tiers.filter((tier) => tier.is_active).map((tier) => <option key={tier.id} value={tier.id}>{tier.name} · ${(tier.price_cents / 100).toFixed(2)}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-player-image">Square cover image URL</Label>
                <Input id="new-player-image" name="coverImageUrl" type="url" placeholder="https://… (optional)" />
              </div>
              <Button type="submit" disabled={pending}><Plus className="size-4" aria-hidden="true" /> Add player</Button>
            </form>

            {playersLoadedFor !== selectedTeam.id ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Loading players…</p>
            ) : players.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center">
                <p className="text-sm text-muted-foreground">No players yet. Add the first player above.</p>
              </div>
            ) : (
              <ul className="grid gap-2">
                {players.map((player) => (
                  <li key={player.id} className="rounded-lg border border-border bg-background/50 p-3">
                    {editingPlayer === player.id ? (
                      <form action={(formData) => handleUpdatePlayer(player, formData)} className="grid gap-3 sm:grid-cols-[1fr_7rem_10rem_1.4fr_auto_auto] sm:items-end">
                        <div className="flex flex-col gap-1.5"><Label htmlFor={`edit-name-${player.id}`}>Player name</Label><Input id={`edit-name-${player.id}`} name="displayName" defaultValue={player.display_name} required /></div>
                        <div className="flex flex-col gap-1.5"><Label htmlFor={`edit-number-${player.id}`}>Number</Label><Input id={`edit-number-${player.id}`} name="jerseyNumber" defaultValue={player.jersey_number} required /></div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor={`edit-tier-${player.id}`}>Gallery tier</Label>
                          <select id={`edit-tier-${player.id}`} name="tierId" defaultValue={player.tier_id ?? ""} className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground focus-visible:border-ring focus-visible:outline-none">
                            <option value="">Not assigned</option>
                            {tiers.map((tier) => <option key={tier.id} value={tier.id} disabled={!tier.is_active && player.tier_id !== tier.id}>{tier.name}{tier.is_active ? ` · $${(tier.price_cents / 100).toFixed(2)}` : " · Paused"}</option>)}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1.5"><Label htmlFor={`edit-image-${player.id}`}>Cover image URL</Label><Input id={`edit-image-${player.id}`} name="coverImageUrl" type="url" defaultValue={player.cover_image_url ?? ""} /></div>
                        <label className="flex h-9 items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" name="isActive" defaultChecked={player.is_active} className="accent-primary" /> Active</label>
                        <div className="flex gap-2"><Button type="submit" size="sm" disabled={pending}>Save</Button><Button type="button" variant="ghost" size="sm" onClick={() => setEditingPlayer(null)}>Cancel</Button></div>
                      </form>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="relative size-14 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                          {player.cover_image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element -- admin roster thumbnail URL
                            <img src={player.cover_image_url} alt="" className="size-full object-cover" />
                          ) : (
                            <span className="flex size-full items-center justify-center font-heading text-xl font-bold text-muted-foreground">{player.jersey_number}</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{player.display_name}</p>
                          <p className="text-xs text-muted-foreground">#{player.jersey_number}{player.is_active ? " · Active" : " · Hidden"}</p>
                          <p className="text-xs text-muted-foreground">{player.tier_name ? `${player.tier_name} · $${((player.tier_price_cents ?? 0) / 100).toFixed(2)}` : "No gallery tier"}</p>
                        </div>
                        <Button type="button" variant={photosFor === player.id ? "secondary" : "outline"} size="sm" onClick={() => void openPlayerPhotos(player.id)} aria-pressed={photosFor === player.id}>
                          <Images className="size-4" aria-hidden="true" />
                          <span className="hidden sm:inline">Photos</span>
                        </Button>
                        <Button type="button" variant="ghost" size="icon-sm" onClick={() => setEditingPlayer(player.id)} aria-label={`Edit ${player.display_name}`}><Pencil className="size-4" aria-hidden="true" /></Button>
                        <Button type="button" variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" onClick={() => void handleDeletePlayer(player)} aria-label={`Delete ${player.display_name}`}><Trash2 className="size-4" aria-hidden="true" /></Button>
                      </div>
                    )}
                    {photosFor === player.id ? (
                      <div className="mt-4 border-t border-border pt-4">
                        <RosterVaultPhotoManager playerId={player.id} photos={photos} onPhotosChange={setPhotos} />
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : (
        <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/50 p-8 text-center">
          <ImagePlus className="size-7 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Create a team or select one to manage its roster.</p>
        </div>
      )}

      <Dialog open={newTeamOpen} onOpenChange={setNewTeamOpen}>
        <DialogContent className="border-border bg-card text-foreground sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create a media-day team</DialogTitle>
            <DialogDescription>Set credentials for parents. The access code and password are hashed immediately and only shown to you as you type them.</DialogDescription>
          </DialogHeader>
          <form action={handleCreateTeam} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5"><Label htmlFor="create-team-name">Team name</Label><Input id="create-team-name" name="teamName" placeholder="Eagles Varsity" required maxLength={100} /></div>
            <div className="flex flex-col gap-1.5"><Label htmlFor="create-team-code">Team access code</Label><Input id="create-team-code" name="accessCode" placeholder="EAGLES2026" autoComplete="off" required minLength={6} maxLength={32} /><p className="text-xs text-muted-foreground">6–32 letters, numbers or hyphens. Case-insensitive.</p></div>
            <div className="flex flex-col gap-1.5"><Label htmlFor="create-team-password">Team password</Label><Input id="create-team-password" name="teamPassword" type="password" autoComplete="new-password" required minLength={10} maxLength={128} /><p className="text-xs text-muted-foreground">At least 10 characters.</p></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setNewTeamOpen(false)}>Cancel</Button><Button type="submit" disabled={pending}>Create team</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
