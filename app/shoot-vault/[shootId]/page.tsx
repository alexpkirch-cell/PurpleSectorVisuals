import { notFound } from "next/navigation"
import type { Metadata } from "next"

import { getShootForVault } from "@/app/actions/shoots"
import { ShootGallery } from "@/components/shoot-vault/shoot-gallery"

export const metadata: Metadata = {
  title: "Your Vault | Purple Sector Visuals",
}

function formatDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
}

export default async function ShootVaultGalleryPage({
  params,
}: {
  params: Promise<{ shootId: string }>
}) {
  const { shootId } = await params
  const data = await getShootForVault(shootId)

  if (!data) {
    notFound()
  }

  const { shoot, sneakPeeks, finals } = data

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-10 px-4 py-16 sm:py-20">
      <header className="flex flex-col gap-2">
        <span className="font-heading text-xs font-bold tracking-[0.18em] text-muted-foreground">
          PURPLE SECTOR VISUALS
        </span>
        <h1 className="font-heading text-2xl font-medium text-foreground sm:text-3xl">
          {shoot.client_name}
        </h1>
        <p className="text-sm text-muted-foreground">
          {shoot.shoot_type}
          {shoot.shoot_date ? ` \u00b7 ${formatDate(shoot.shoot_date)}` : ""}
        </p>
      </header>

      <ShootGallery shootId={shoot.id} sneakPeeks={sneakPeeks} finals={finals} />
    </main>
  )
}
