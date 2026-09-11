import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { getVaultGallery } from "@/app/actions/vault"
import { createAdminClient } from "@/lib/supabase/server"
import { VaultGallery } from "@/components/vault/vault-gallery"

export const metadata: Metadata = {
  title: "Your Gallery | Purple Sector Visuals",
  robots: { index: false, follow: false },
}

export default async function VaultGalleryPage({
  params,
}: {
  params: Promise<{ galleryId: string }>
}) {
  const { galleryId } = await params
  const gallery = await getVaultGallery(galleryId)

  if (!gallery) {
    redirect("/vault")
  }

  const admin = createAdminClient()
  const { data: photos } = await admin
    .from("gallery_photos")
    .select("id, file_name, storage_path, is_before_after, before_storage_path")
    .eq("gallery_id", galleryId)
    .order("created_at", { ascending: true })

  return (
    <main className="min-h-screen px-4 py-16 sm:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <div>
          <span className="font-heading text-xs font-bold tracking-[0.18em] text-muted-foreground">
            PURPLE SECTOR VISUALS
          </span>
          <h1 className="mt-1 font-heading text-2xl font-medium text-foreground">{gallery.title}</h1>
          {gallery.client_name && (
            <p className="mt-1 text-sm text-muted-foreground">Delivered to {gallery.client_name}</p>
          )}
        </div>

        <VaultGallery galleryId={galleryId} photos={photos ?? []} />
      </div>
    </main>
  )
}
