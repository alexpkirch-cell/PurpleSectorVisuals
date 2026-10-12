"use client"

import { useState } from "react"
import { Loader2, Plus } from "lucide-react"
import { toast } from "sonner"

import { createPhotographer, type RosterContractor } from "@/app/actions/roster"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ROSTER_PORTFOLIOS_BUCKET } from "@/lib/storage-buckets"
import { uploadPublicImage } from "@/lib/upload-public-image"

export function AddPhotographerDialog({ onCreated }: { onCreated: (contractor: RosterContractor) => void }) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const profileFile = data.get("profile") as File | null
    const portfolioFiles = (data.getAll("portfolio") as File[]).filter((f) => f.size > 0)

    setSubmitting(true)
    try {
      const folder = crypto.randomUUID()
      const profileImageUrl =
        profileFile && profileFile.size > 0
          ? await uploadPublicImage(ROSTER_PORTFOLIOS_BUCKET, `${folder}/profile`, profileFile)
          : null
      const portfolioImageUrls = await Promise.all(
        portfolioFiles.map((file) => uploadPublicImage(ROSTER_PORTFOLIOS_BUCKET, `${folder}/portfolio`, file)),
      )

      const contractor = await createPhotographer({
        name: String(data.get("name") ?? ""),
        bio: String(data.get("bio") ?? ""),
        profileImageUrl,
        portfolioImageUrls,
      })

      onCreated({ ...contractor, portfolio_image_urls: contractor.portfolio_image_urls ?? [] })
      toast.success(`${contractor.name} added to the roster`)
      form.reset()
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add photographer")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && setOpen(next)}>
      <DialogTrigger render={<Button />}>
        <Plus />
        Add New Photographer
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add new photographer</DialogTitle>
          <DialogDescription>
            Creates a roster entry and a public portfolio page at /team/[id].
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto px-0.5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="photographer-name">Name</Label>
            <Input id="photographer-name" name="name" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="photographer-bio">Bio</Label>
            <Textarea id="photographer-bio" name="bio" rows={4} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="photographer-profile">Profile picture</Label>
            <Input id="photographer-profile" name="profile" type="file" accept="image/*" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="photographer-portfolio">Portfolio images</Label>
            <Input id="photographer-portfolio" name="portfolio" type="file" accept="image/*" multiple />
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="animate-spin" />}
            {submitting ? "Uploading…" : "Add photographer"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
