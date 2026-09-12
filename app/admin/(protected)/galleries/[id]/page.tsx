import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { GalleryUploadManager } from "@/components/admin/gallery-upload-manager"
import { UsbStatusSelect } from "@/components/admin/usb-status-select"
import type { UsbStatus } from "@/app/actions/admin-galleries"

export const metadata: Metadata = {
  title: "Gallery | Purple Sector Visuals Admin",
  robots: { index: false, follow: false },
}

export default async function AdminGalleryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: gallery } = await supabase
    .from("galleries")
    .select("id, title, client_name, access_key, usb_status, created_at")
    .eq("id", id)
    .single()

  if (!gallery) {
    notFound()
  }

  const { data: photos } = await supabase
    .from("gallery_photos")
    .select("id, file_name, storage_path, content_type, is_before_after, before_storage_path")
    .eq("gallery_id", id)
    .order("created_at", { ascending: true })

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-medium text-foreground">{gallery.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {gallery.client_name ? `${gallery.client_name} · ` : ""}
            Created {new Date(gallery.created_at).toLocaleDateString()}
          </p>
        </div>
        <UsbStatusSelect galleryId={gallery.id} status={gallery.usb_status as UsbStatus} />
      </div>

      <GalleryUploadManager
        galleryId={gallery.id}
        accessKey={gallery.access_key}
        photos={photos ?? []}
      />
    </div>
  )
}
