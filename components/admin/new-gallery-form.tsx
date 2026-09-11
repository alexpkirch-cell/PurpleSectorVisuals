"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"

import { createGallery } from "@/app/actions/admin-galleries"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function NewGalleryForm() {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    setError(null)
    setIsSubmitting(true)
    try {
      const galleryId = await createGallery(formData)
      formRef.current?.reset()
      router.push(`/admin/galleries/${galleryId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex flex-col gap-4 sm:flex-row sm:items-end">
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="title">Gallery title</Label>
        <Input id="title" name="title" placeholder="e.g. Summer Nationals — Alex" required />
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="clientName">Client name</Label>
        <Input id="clientName" name="clientName" placeholder="e.g. Jordan Miles" />
      </div>
      <Button type="submit" disabled={isSubmitting} className="shrink-0">
        <Plus data-icon="inline-start" />
        {isSubmitting ? "Creating…" : "New gallery"}
      </Button>
      {error && <p className="text-sm text-destructive sm:basis-full">{error}</p>}
    </form>
  )
}
