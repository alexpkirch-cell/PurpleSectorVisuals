"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { saveDirectoryMember } from "@/app/actions/team-directory"
import { MultiSelect } from "@/components/admin/multi-select"
import { TagInput } from "@/components/admin/tag-input"
import { CutoutUploader, HighlightMediaUploader } from "@/components/admin/crew/team-media-uploaders"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  SUGGESTED_ROLES,
  SPECIALTY_OPTIONS,
  type DirectoryMember,
} from "@/lib/team-directory"

type TeamMemberSheetProps = {
  member: DirectoryMember | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (member: DirectoryMember) => void
}

export function TeamMemberSheet({ member, open, onOpenChange, onSaved }: TeamMemberSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-xl">
        {/* Keyed so each member (or a new draft) starts from fresh form state. */}
        <MemberForm key={member?.id ?? "new"} member={member} onOpenChange={onOpenChange} onSaved={onSaved} />
      </SheetContent>
    </Sheet>
  )
}

function MemberForm({
  member,
  onOpenChange,
  onSaved,
}: {
  member: DirectoryMember | null
  onOpenChange: (open: boolean) => void
  onSaved: (member: DirectoryMember) => void
}) {
  const [name, setName] = useState(member?.name ?? "")
  const [bio, setBio] = useState(member?.bio ?? "")
  const [cutout, setCutout] = useState(member?.cutout_image_url ?? "")
  const [highlights, setHighlights] = useState<string[]>(member?.highlight_media ?? [])
  const [roles, setRoles] = useState<string[]>(member?.roles ?? [])
  const [specialties, setSpecialties] = useState<string[]>(member?.specialties ?? [])
  const [isActive, setIsActive] = useState(member?.is_active ?? true)
  const [pending, startTransition] = useTransition()

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      try {
        const saved = await saveDirectoryMember({
          id: member?.id,
          name,
          bio,
          cutoutImageUrl: cutout || null,
          highlightMedia: highlights,
          roles,
          specialties,
          isActive,
        })
        toast.success(member ? `${saved.name} updated` : `${saved.name} added to the roster`)
        onSaved(saved)
        onOpenChange(false)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not save team member")
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <SheetHeader>
        <SheetTitle>{member ? `Edit ${member.name}` : "Add team member"}</SheetTitle>
        <SheetDescription>
          {member ? `Public profile lives at /team/${member.slug}.` : "A profile URL is generated from the name."}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 pb-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="team-name">Name</Label>
          <Input id="team-name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="team-bio">Bio</Label>
          <Textarea
            id="team-bio"
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            rows={5}
            maxLength={3000}
            placeholder="A few sentences on their craft and what they bring to a shoot."
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="team-roles">Roles</Label>
          <TagInput id="team-roles" value={roles} onChange={setRoles} suggestions={SUGGESTED_ROLES} placeholder="Shooter, Editor, Admin" max={10} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="team-specialties">Specialties</Label>
          <MultiSelect
            id="team-specialties"
            options={SPECIALTY_OPTIONS}
            value={specialties}
            onChange={setSpecialties}
            placeholder="Choose specialties"
            max={12}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Cutout image</Label>
          <CutoutUploader value={cutout} onChange={setCutout} />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Highlight media</Label>
          <HighlightMediaUploader value={highlights} onChange={setHighlights} />
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
          <div className="flex flex-col gap-0.5">
            <Label htmlFor="team-active">Show on public Team page</Label>
            <span className="text-xs text-muted-foreground">Inactive members are hidden from /team and their profile.</span>
          </div>
          <Switch id="team-active" checked={isActive} onCheckedChange={setIsActive} />
        </div>
      </div>

      <SheetFooter className="border-t border-border">
        <Button type="submit" disabled={pending || !name.trim()}>
          {pending ? "Saving..." : member ? "Save changes" : "Add to roster"}
        </Button>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
          Cancel
        </Button>
      </SheetFooter>
    </form>
  )
}
