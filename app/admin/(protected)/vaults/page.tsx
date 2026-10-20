import type { Metadata } from "next"

import { createClient } from "@/lib/supabase/server"
import { NewGalleryForm } from "@/components/admin/new-gallery-form"
import { GalleryList } from "@/components/admin/gallery-list"

export const metadata: Metadata = {
  title: "Galleries | Purple Sector Visuals Admin",
  robots: { index: false, follow: false },
}

export default async function AdminGalleriesPage() {
  const supabase = await createClient()
  const { data: galleries } = await supabase
    .from("galleries")
    .select("id, title, client_name, access_key, created_at")
    .order("created_at", { ascending: false })

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-medium text-foreground">Client Galleries</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a delivery gallery, upload the edited photos, and share the access key with your
          client.
        </p>
      </div>

      <NewGalleryForm />

      <GalleryList galleries={galleries ?? []} />
    </div>
  )
}
