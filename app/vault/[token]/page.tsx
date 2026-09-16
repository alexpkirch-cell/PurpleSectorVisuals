import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Clock, KeyRound } from "lucide-react"

import { getVaultGallery } from "@/app/actions/vault"
import { lookupVaultByPin } from "@/app/actions/vault-pin"
import { BlooperReel } from "@/components/vault/blooper-reel"
import { OnboardingWizard } from "@/components/vault/onboarding-wizard"
import { VaultGallery } from "@/components/vault/vault-gallery"
import { createAdminClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Client Vault | Purple Sector Visuals",
  robots: { index: false, follow: false },
}

function VaultShell({ children, heading }: { children: React.ReactNode; heading?: string }) {
  return (
    <main className="min-h-screen px-4 py-16 sm:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <div>
          <span className="font-heading text-xs font-bold tracking-[0.18em] text-muted-foreground">
            PURPLE SECTOR VISUALS
          </span>
          {heading && <h1 className="mt-1 font-heading text-2xl font-medium text-foreground">{heading}</h1>}
        </div>
        {children}
      </div>
    </main>
  )
}

// A 4-6 digit token is a booking-vault PIN; anything else is a legacy delivered-gallery ID.
function isPin(token: string) {
  return /^\d{4,6}$/.test(token)
}

export default async function VaultTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  if (!isPin(token)) {
    return <LegacyGalleryView galleryId={token} />
  }

  const result = await lookupVaultByPin(token)

  if (!result.found) {
    return (
      <VaultShell heading="Vault Not Found">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center">
          <KeyRound className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            We couldn&apos;t find a vault with that PIN. Double-check the code your photographer sent you.
          </p>
          <Link href="/vault" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            Back to Client Vault
          </Link>
        </div>
      </VaultShell>
    )
  }

  if (result.secret) {
    return (
      <VaultShell>
        <BlooperReel />
      </VaultShell>
    )
  }

  const { vault } = result

  if (vault.status === "Expired") {
    return (
      <VaultShell heading="Vault Expired">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center">
          <Clock className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            This vault&apos;s access window has closed. Reach out to us and we&apos;ll help you retrieve your
            gallery.
          </p>
        </div>
      </VaultShell>
    )
  }

  if (vault.status === "Onboarding") {
    return (
      <VaultShell heading={`Welcome, ${vault.clientName}`}>
        <OnboardingWizard
          vaultId={vault.id}
          category={vault.category}
          contractSigned={vault.contractSigned}
          depositPaid={vault.depositPaid}
        />
      </VaultShell>
    )
  }

  // Active vault — reuse the existing gallery viewer, keyed by gallery_id.
  let photos: { id: string; file_name: string; storage_path: string; url: string | null }[] = []

  if (vault.galleryId) {
    const admin = createAdminClient()
    const { data: rows } = await admin
      .from("gallery_photos")
      .select("id, file_name, storage_path")
      .eq("gallery_id", vault.galleryId)
      .order("created_at", { ascending: true })

    photos = await Promise.all(
      (rows ?? []).map(async (row) => {
        const { data: signed } = await admin.storage
          .from("gallery-photos")
          .createSignedUrl(row.storage_path as string, 3600)
        return {
          id: row.id as string,
          file_name: row.file_name as string,
          storage_path: row.storage_path as string,
          url: signed?.signedUrl ?? null,
        }
      })
    )
  }

  return (
    <VaultShell heading={`${vault.clientName}'s Gallery`}>
      {photos.length > 0 ? (
        <VaultGallery galleryId={vault.galleryId as string} photos={photos} />
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Your vault is active! Your photos are being edited and will appear here as soon as they&apos;re ready.
          </p>
        </div>
      )}
    </VaultShell>
  )
}

async function LegacyGalleryView({ galleryId }: { galleryId: string }) {
  const gallery = await getVaultGallery(galleryId)

  if (!gallery) {
    redirect("/vault")
  }

  const admin = createAdminClient()
  const { data: rows } = await admin
    .from("gallery_photos")
    .select("id, file_name, storage_path, is_before_after, before_storage_path")
    .eq("gallery_id", galleryId)
    .order("created_at", { ascending: true })

  const photos = await Promise.all(
    (rows ?? []).map(async (row) => {
      const { data: signed } = await admin.storage
        .from("gallery-photos")
        .createSignedUrl(row.storage_path as string, 3600)

      return {
        id: row.id as string,
        file_name: row.file_name as string,
        storage_path: row.storage_path as string,
        url: signed?.signedUrl ?? null,
      }
    })
  )

  return (
    <VaultShell heading={gallery.title}>
      {gallery.client_name && (
        <p className="-mt-6 text-sm text-muted-foreground">Delivered to {gallery.client_name}</p>
      )}
      <VaultGallery galleryId={galleryId} photos={photos ?? []} />
    </VaultShell>
  )
}
