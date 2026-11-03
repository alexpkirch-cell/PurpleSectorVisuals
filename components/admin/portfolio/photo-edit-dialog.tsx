"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { updatePortfolioItem, type PortfolioItem } from "@/app/actions/portfolio"
import { MultiSelect } from "@/components/admin/multi-select"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PORTFOLIO_CATEGORY_OPTIONS, isPortfolioCategory, itemCategories } from "@/lib/portfolio-categories"

const TEAM_OPTION = "Team"
const UNASSIGNED = "__unassigned__"
const MAX_TITLE_LENGTH = 200

interface PhotoEditDialogProps {
  item: PortfolioItem
  people: string[]
  onOpenChange: (open: boolean) => void
  onSaved: (updated: PortfolioItem) => void
}

function PersonSelect({
  id,
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  id: string
  label: string
  value: string
  options: string[]
  disabled: boolean
  onChange: (value: string) => void
}) {
  const choices = [...new Set([...options, ...(value !== UNASSIGNED ? [value] : [])])]

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Select value={value} onValueChange={(next) => next && onChange(next)} disabled={disabled}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
          {choices.map((name) => (
            <SelectItem key={name} value={name}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function PhotoEditDialog({ item, people, onOpenChange, onSaved }: PhotoEditDialogProps) {
  const [title, setTitle] = useState(item.title ?? "")
  const [shooter, setShooter] = useState(item.shot_by ?? item.shooter ?? UNASSIGNED)
  const [editor, setEditor] = useState(item.edited_by ?? UNASSIGNED)
  const [categories, setCategories] = useState<string[]>(itemCategories(item))
  const [saving, setSaving] = useState(false)

  const options = [...new Set([...people, TEAM_OPTION])]

  async function handleSave() {
    const nextCategories = categories.filter(isPortfolioCategory)
    if (nextCategories.length === 0) {
      toast.error("Choose at least one category")
      return
    }

    const nextTitle = title.trim().slice(0, MAX_TITLE_LENGTH)
    const nextShooter = shooter === UNASSIGNED ? null : shooter
    const nextEditor = editor === UNASSIGNED ? null : editor

    setSaving(true)
    try {
      await updatePortfolioItem(item.id, {
        title: nextTitle,
        categories: nextCategories,
        shooter: nextShooter,
        shot_by: nextShooter,
        edited_by: nextEditor,
      })
      onSaved({
        ...item,
        title: nextTitle,
        category: nextCategories[0],
        categories: nextCategories,
        shooter: nextShooter,
        shot_by: nextShooter,
        edited_by: nextEditor,
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
            <PersonSelect
              id="edit-photo-shooter"
              label="Shooter"
              value={shooter}
              options={options}
              disabled={saving}
              onChange={setShooter}
            />
            <PersonSelect
              id="edit-photo-editor"
              label="Editor"
              value={editor}
              options={options}
              disabled={saving}
              onChange={setEditor}
            />
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
