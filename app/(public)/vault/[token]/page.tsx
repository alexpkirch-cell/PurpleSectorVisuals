import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Clock } from "lucide-react"

import { getVaultGallery } from "@/app/actions/vault"
import { lookupVaultByPin } from "@/app/actions/vault-pin"
import { BlooperReel } from "@/components/vault/blooper-reel"
import { LockedGallery } from "@/components/vault/locked-gallery"
import { VaultPortal } from "@/components/vault/portal/vault-portal"
import { VaultGallery } from "@/components/vault/vault-gallery"
import { formatShootDate } from "@/lib/operations"
import { createAdminClient } from "@/lib/supabase/server"
import { isDeliveredStatus } from "@/lib/vault-progress"
import { hasVaultSession, isAdminViewer } from "@/lib/vault-session"

export const metadata: Metadata = {
  title: "Client Vault | Purple Sector Visuals",
  robots: { index: false, follow: false },
}

function VaultShell({ children, heading }: { children: React.ReactNode; heading?: string }) {
  return (
    <main className="min-h-screen px-4 pb-16 pt-32 sm:px-8 sm:pt-36">
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

export default async function VaultTokenPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ view?: string }>
}) {
  const { token } = await params
  const { view } = await searchParams

  if (!isPin(token)) {
    return <LegacyGalleryView galleryId={token} />
  }

  const result = await lookupVaultByPin(token)

  // Unknown PINs and unauthenticated visitors get the same redirect so PINs can't be probed via the URL.
  if (!result.found) {
    redirect("/vault")
  }

  if (result.secret) {
    return (
      <VaultShell>
        <BlooperReel />
      </VaultShell>
    )
  }

  const { vault } = result

  // The PIN alone is never enough: the client must have signed in with their email + PIN.
  const hasAccess = (await hasVaultSession(vault.id)) || (await isAdminViewer())
  if (!hasAccess) {
    redirect("/vault")
  }

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

  const delivered = isDeliveredStatus(vault.shootStatus)
  const balanceDue = vault.balanceAmount && vault.balanceAmount > 0 && !vault.balancePaid ? vault.balanceAmount : null

  if (!(view === "gallery" && delivered)) {
    return (
      <VaultShell heading={`Welcome, ${vault.clientName}`}>
        <VaultPortal
          vaultId={vault.id}
          token={token}
          category={vault.category}
          location={vault.location}
          shootDateLabel={formatShootDate(vault.shootDate, true)}
          contractHtml={vault.contractHtml}
          invoice={vault.invoiceData}
          isComped={vault.isComped}
          balanceDue={balanceDue}
          mustHaveShots={vault.mustHaveShots}
          moodBoardLinks={vault.moodBoardLinks}
          prepSubmitted={vault.prepSubmittedAt !== null}
          initialProgress={{
            shootStatus: vault.shootStatus,
            photoCount: vault.photoCount,
            contractSigned: vault.contractSigned,
            depositPaid: vault.depositPaid,
          }}
        />
      </VaultShell>
    )
  }

  // Delivered: the final gallery viewer, keyed by gallery_id.
  let photos: { id: string; file_name: string; storage_path: string; url: string | null; isFavorited: boolean }[] = []

  if (vault.galleryId) {
    const admin = createAdminClient()
    const { data: rows } = await admin
      .from("gallery_photos")
      .select("id, file_name, storage_path, is_favorited")
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
          isFavorited: Boolean(row.is_favorited),
        }
      })
    )
  }

  // Balance owed but not yet paid — the gallery is fully delivered but stays
  // locked behind a blurred preview until settlement clears.
  const balanceOwed = vault.balanceAmount && vault.balanceAmount > 0 && !vault.balancePaid

  return (
    <VaultShell heading={`${vault.clientName}'s Gallery`}>
      {photos.length > 0 ? (
        balanceOwed ? (
          <LockedGallery vaultId={vault.id} photoCount={photos.length} balanceAmount={vault.balanceAmount as number} />
        ) : (
          <VaultGallery galleryId={vault.galleryId as string} photos={photos} expiresAt={vault.expiresAt} />
        )
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
    .select("id, file_name, storage_path, is_before_after, before_storage_path, is_favorited")
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
        isFavorited: Boolean(row.is_favorited),
      }
    })
  )

  return (
    <VaultShell heading={gallery.title}>
      {gallery.client_name && <p className="-mt-6 text-sm text-muted-foreground">Delivered to {gallery.client_name}</p>}
      <VaultGallery galleryId={galleryId} photos={photos ?? []} />
    </VaultShell>
  )
}
