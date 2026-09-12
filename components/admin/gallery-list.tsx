"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Trash2 } from "lucide-react"

import { deleteGallery } from "@/app/actions/admin-galleries"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

type Gallery = {
  id: string
  title: string
  client_name: string | null
  access_key: string
  created_at: string
}

export function GalleryList({ galleries }: { galleries: Gallery[] }) {
  const router = useRouter()
  const [pendingId, setPendingId] = useState<string | null>(null)

  async function handleDelete(id: string) {
    setPendingId(id)
    try {
      await deleteGallery(id)
      router.refresh()
    } finally {
      setPendingId(null)
    }
  }

  if (galleries.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        No galleries yet. Create one above to start delivering photos to a client.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {galleries.map((gallery) => (
        <Card key={gallery.id}>
          <CardContent className="flex items-center justify-between gap-4">
            <Link href={`/admin/galleries/${gallery.id}`} className="flex-1">
              <p className="font-medium text-foreground">{gallery.title}</p>
              <p className="text-sm text-muted-foreground">
                {gallery.client_name ? `${gallery.client_name} · ` : ""}
                {new Date(gallery.created_at).toLocaleDateString()}
              </p>
            </Link>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={pendingId === gallery.id}
              onClick={() => handleDelete(gallery.id)}
              aria-label={`Delete ${gallery.title}`}
            >
              <Trash2 className="size-4" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
