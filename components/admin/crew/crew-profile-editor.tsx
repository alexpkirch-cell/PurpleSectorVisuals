"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Archive, ArchiveRestore, FileText, Loader2, Upload, User } from "lucide-react"
import { toast } from "sonner"

import {
  setCrewActive,
  setCrewContractPath,
  updateCrewProfile,
  type CrewMember,
  type SplitTier,
} from "@/app/actions/crew"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"
import { BUSINESS_DOCUMENTS_BUCKET, ROSTER_PORTFOLIOS_BUCKET } from "@/lib/storage-buckets"
import { uploadPublicImage } from "@/lib/upload-public-image"

export function CrewProfileEditor({ member, contractUrl }: { member: CrewMember; contractUrl: string | null }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(member.name)
  const [bio, setBio] = useState(member.bio ?? "")
  const [splitTier, setSplitTier] = useState<SplitTier>(member.split_tier)
  const [profileImageUrl, setProfileImageUrl] = useState(member.profile_image_url)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [uploadingContract, setUploadingContract] = useState(false)
  const [pending, startTransition] = useTransition()

  async function handlePhoto(file: File | undefined) {
    if (!file) return
    setUploadingPhoto(true)
    try {
      setProfileImageUrl(await uploadPublicImage(ROSTER_PORTFOLIOS_BUCKET, `${member.id}/profile`, file))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Photo upload failed")
    } finally {
      setUploadingPhoto(false)
    }
  }

  async function handleContract(file: File | undefined) {
    if (!file) return
    if (file.type !== "application/pdf") {
      toast.error("The contract must be a PDF.")
      return
    }
    setUploadingContract(true)
    try {
      const path = `contractors/${member.id}/${crypto.randomUUID()}.pdf`
      const { error } = await createClient()
        .storage.from(BUSINESS_DOCUMENTS_BUCKET)
        .upload(path, file, { contentType: "application/pdf" })
      if (error) throw new Error(error.message)
      await setCrewContractPath(member.id, path)
      toast.success("Contract uploaded")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Contract upload failed")
    } finally {
      setUploadingContract(false)
    }
  }

  function save() {
    startTransition(async () => {
      try {
        await updateCrewProfile(member.id, { name, bio, profileImageUrl, splitTier })
        toast.success("Profile saved")
        setEditing(false)
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not save profile")
      }
    })
  }

  function toggleActive() {
    startTransition(async () => {
      try {
        await setCrewActive(member.id, !member.is_active)
        toast.success(member.is_active ? `${member.name} archived` : `${member.name} restored`)
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not update status")
      }
    })
  }

  return (
    <section className="flex flex-col gap-5 rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-heading text-lg font-medium text-foreground">Public profile</h2>
        <div className="flex items-center gap-2">
          <Label htmlFor="edit-profile" className="text-sm text-muted-foreground">
            Edit profile
          </Label>
          <Switch id="edit-profile" checked={editing} onCheckedChange={setEditing} />
        </div>
      </div>

      <div className="flex items-start gap-4">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground">
          {profileImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- admin preview of an uploaded public asset
            <img src={profileImageUrl} alt={member.name} crossOrigin="anonymous" className="size-full object-cover" />
          ) : (
            <User className="size-7" />
          )}
        </div>

        {editing ? (
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="crew-name">Name</Label>
              <Input id="crew-name" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="crew-bio">Bio</Label>
              <Textarea id="crew-bio" rows={4} value={bio} onChange={(event) => setBio(event.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="crew-split">Revenue split</Label>
              <select
                id="crew-split"
                value={splitTier}
                onChange={(event) => setSplitTier(event.target.value as SplitTier)}
                className="h-9 w-48 rounded-md border border-border bg-background px-2 text-sm text-foreground"
              >
                <option value="50_50">50/50</option>
                <option value="70_30">70/30</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="crew-photo">Profile photo</Label>
              <Input
                id="crew-photo"
                type="file"
                accept="image/jpeg, image/png, image/webp, image/heic, .heic"
                disabled={uploadingPhoto}
                onChange={(event) => handlePhoto(event.target.files?.[0])}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={save} disabled={pending || uploadingPhoto}>
                {pending && <Loader2 className="animate-spin" />}
                Save changes
              </Button>
              <Button variant="outline" onClick={() => setEditing(false)} disabled={pending}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">{member.name}</p>
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {member.bio || "No bio yet."}
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        {contractUrl ? (
          <Button variant="outline" size="sm" render={<a href={contractUrl} target="_blank" rel="noopener noreferrer" />}>
            <FileText />
            Signed 1099 contract
          </Button>
        ) : (
          <span className="text-sm text-muted-foreground">No signed contract on file.</span>
        )}
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          {uploadingContract ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {contractUrl ? "Replace PDF" : "Upload PDF"}
          <input
            type="file"
            accept="application/pdf"
            className="sr-only"
            disabled={uploadingContract}
            onChange={(event) => handleContract(event.target.files?.[0])}
          />
        </label>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={toggleActive} disabled={pending}>
          {member.is_active ? <Archive /> : <ArchiveRestore />}
          {member.is_active ? "Archive contractor" : "Restore contractor"}
        </Button>
      </div>
    </section>
  )
}
