"use client"

import { useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { updatePortfolioItem, type PortfolioItem } from "@/app/actions/portfolio"
import { MultiSelect } from "@/components/admin/multi-select"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PORTFOLIO_CATEGORY_OPTIONS, isPortfolioCategory, itemCategories } from "@/lib/portfolio-categories"

const MAX_TITLE_LENGTH = 200
const MAX_CREDITS = 12

interface PhotoEditDialogProps {
  item: PortfolioItem
  teamMembers: { id: string; name: string }[]
  onOpenChange: (open: boolean) => void
  onSaved: (updated: PortfolioItem) => void
}

/** Linked IDs when the join table has them; otherwise match the legacy credit text against active team names. */
function initialCreditIds(linkedIds: string[] | undefined, creditText: string | null | undefined, members: { id: string; name: string }[]) {
  if (linkedIds && linkedIds.length > 0) return linkedIds
  const byName = new Map(members.map((member) => [member.name.trim().toLowerCase(), member.id]))
  return (creditText ?? "")
    .split(",")
    .map((name) => byName.get(name.trim().toLowerCase()))
    .filter((id): id is string => Boolean(id))
}

function sameIds(a: string[], b: string[]) {
  return a.length === b.length && a.every((id, index) => id === b[index])
}

export function PhotoEditDialog({ item, teamMembers, onOpenChange, onSaved }: PhotoEditDialogProps) {
  const initialShooters = useMemo(
    () => initialCreditIds(item.shooter_ids, item.shot_by ?? item.shooter, teamMembers),
    [item, teamMembers],
  )
  const initialEditors = useMemo(
    () => initialCreditIds(item.editor_ids, item.edited_by, teamMembers),
    [item, teamMembers],
  )

  const [title, setTitle] = useState(item.title ?? "")
  const [shooterIds, setShooterIds] = useState<string[]>(initialShooters)
  const [editorIds, setEditorIds] = useState<string[]>(initialEditors)
  const [categories, setCategories] = useState<string[]>(itemCategories(item))
  const [saving, setSaving] = useState(false)

  const memberOptions = teamMembers.map((member) => ({ value: member.id, label: member.name }))
  const namesFor = (ids: string[]) =>
    ids.map((id) => teamMembers.find((member) => member.id === id)?.name).filter((name): name is string => Boolean(name))

  async function handleSave() {
    const nextCategories = categories.filter(isPortfolioCategory)
    if (nextCategories.length === 0) {
      toast.error("Choose at least one category")
      return
    }

    const nextTitle = title.trim().slice(0, MAX_TITLE_LENGTH)
    const shootersChanged = !sameIds(shooterIds, initialShooters)
    const editorsChanged = !sameIds(editorIds, initialEditors)

    setSaving(true)
    try {
      // Credits are only sent when they were edited, so untouched legacy credit text is never overwritten.
      await updatePortfolioItem(item.id, {
        title: nextTitle,
        categories: nextCategories,
        ...(shootersChanged ? { shooter_ids: shooterIds } : {}),
        ...(editorsChanged ? { editor_ids: editorIds } : {}),
      })

      const shooterText = namesFor(shooterIds).join(", ") || null
      const editorText = namesFor(editorIds).join(", ") || null
      onSaved({
        ...item,
        title: nextTitle,
        category: nextCategories[0],
        categories: nextCategories,
        ...(shootersChanged ? { shooter: shooterText, shot_by: shooterText, shooter_ids: shooterIds } : {}),
        ...(editorsChanged ? { edited_by: editorText, editor_ids: editorIds } : {}),
      })
      toast.success("Photo updated")
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save changes")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit photo</DialogTitle>
          <DialogDescription>Update who shot and edited this photo, its title, and where it appears.</DialogDescription>
        </DialogHeader>

        <div className="flex max-h-72 w-full items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element -- portfolio images come from the public portfolio-images bucket */}
          <img
            src={item.image_url}
            alt={item.title || "Portfolio photo"}
            crossOrigin="anonymous"
            className="h-auto max-h-72 w-auto max-w-full object-contain"
          />
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-photo-title" className="text-xs text-muted-foreground">
              Title
            </Label>
            <Input
              id="edit-photo-title"
              value={title}
              maxLength={MAX_TITLE_LENGTH}
              disabled={saving}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Untitled"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-photo-shooters" className="text-xs text-muted-foreground">
                Shooters
              </Label>
              <MultiSelect
                id="edit-photo-shooters"
                options={memberOptions}
                value={shooterIds}
                onChange={setShooterIds}
                placeholder="Select shooters"
                max={MAX_CREDITS}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-photo-editors" className="text-xs text-muted-foreground">
                Editors
              </Label>
              <MultiSelect
                id="edit-photo-editors"
                options={memberOptions}
                value={editorIds}
                onChange={setEditorIds}
                placeholder="Select editors"
                max={MAX_CREDITS}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-photo-categories" className="text-xs text-muted-foreground">
              Category
            </Label>
            <MultiSelect
              id="edit-photo-categories"
              options={PORTFOLIO_CATEGORY_OPTIONS}
              value={categories}
              onChange={setCategories}
              placeholder="Choose one or more"
            />
            <p className="text-xs text-muted-foreground">The first one you pick is the primary category.</p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
