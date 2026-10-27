"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { saveRosterMember } from "@/app/actions/crew-roster"
import { MultiSelect } from "@/components/admin/multi-select"
import { TagInput } from "@/components/admin/tag-input"
import { CutoutUploader, HighlightMediaUploader } from "@/components/admin/crew/team-media-uploaders"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  SUGGESTED_ROLES,
  SPECIALTY_OPTIONS,
  slugify,
  type DirectoryMember,
} from "@/lib/team-directory"

export function RosterEditorForm({ member }: { member: DirectoryMember | null }) {
  const router = useRouter()
  const [name, setName] = useState(member?.name ?? "")
  const [slug, setSlug] = useState(member?.slug ?? "")
  const [slugEdited, setSlugEdited] = useState(Boolean(member))
  const [bio, setBio] = useState(member?.bio ?? "")
  const [roles, setRoles] = useState<string[]>(member?.roles ?? [])
  const [specialties, setSpecialties] = useState<string[]>(member?.specialties ?? [])
  const [isActive, setIsActive] = useState(member?.is_active ?? true)
  const [cutout, setCutout] = useState(member?.cutout_image_url ?? "")
  const [highlights, setHighlights] = useState<string[]>(member?.highlight_media ?? [])
  const [pending, startTransition] = useTransition()

  const effectiveSlug = slugEdited ? slug : slugify(name)

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const result = await saveRosterMember({
        id: member?.id,
        name,
        slug: effectiveSlug,
        bio,
        roles,
        specialties,
        isActive,
        cutoutImageUrl: cutout || null,
        highlightMedia: highlights,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(member ? `${result.member.name} updated` : `${result.member.name} added to the roster`)
      if (member) {
        setSlug(result.member.slug)
        router.refresh()
      } else {
        router.replace(`/admin/crew/${result.member.id}`)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="roster-name">Name</Label>
            <Input
              id="roster-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              required
              placeholder="Alex Kirch"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="roster-slug">Slug</Label>
            <Input
              id="roster-slug"
              value={effectiveSlug}
              onChange={(event) => {
                setSlugEdited(true)
                setSlug(slugify(event.target.value))
              }}
              maxLength={60}
              placeholder="alex-kirch"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Public profile lives at /team/{effectiveSlug || "your-slug"}.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="roster-bio">Bio</Label>
            <Textarea
              id="roster-bio"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              rows={7}
              maxLength={3000}
              placeholder="A short introduction shown on the member's public profile."
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="roster-roles">Roles</Label>
            <TagInput
              id="roster-roles"
              value={roles}
              onChange={setRoles}
              suggestions={SUGGESTED_ROLES}
              placeholder="Shooter, Editor, Admin"
              max={10}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="roster-specialties">Specialties</Label>
            <MultiSelect
              id="roster-specialties"
              options={SPECIALTY_OPTIONS}
              value={specialties}
              onChange={setSpecialties}
              placeholder="Choose specialties"
              max={12}
            />
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="roster-active">Show on public Team page</Label>
              <span className="text-xs text-muted-foreground">
                Inactive members are hidden from /team and their profile.
              </span>
            </div>
            <Switch id="roster-active" checked={isActive} onCheckedChange={setIsActive} />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Cutout image</Label>
            <CutoutUploader value={cutout} onChange={setCutout} />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Highlight media</Label>
        <HighlightMediaUploader value={highlights} onChange={setHighlights} />
      </div>

      <div className="flex items-center gap-3 border-t border-border pt-6">
        <Button type="submit" disabled={pending || !name.trim()}>
          {pending ? "Saving..." : member ? "Save Changes" : "Add to Roster"}
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={() => router.push("/admin/crew")}>
          Back to Roster
        </Button>
      </div>
    </form>
  )
}
