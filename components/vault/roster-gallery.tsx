"use client"

import { useState, useTransition } from "react"
import JSZip from "jszip"
import { ArrowLeft, Download, ImageOff, LockKeyhole, LogOut, ShieldCheck, ShoppingCart } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { logoutRosterVault, type RosterGalleryView } from "@/app/actions/roster-vault"
import { startRosterGalleryCheckout } from "@/app/actions/roster-vault-payments"
import { Button } from "@/components/ui/button"
import { RosterPrintOrderDialog } from "@/components/vault/roster-print-order-dialog"

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
const formatCents = (cents: number) => currency.format(cents / 100)

function photoCountLabel(count: number) {
  return `${count} photo${count === 1 ? "" : "s"}`
}

function StatusBadge({ view, lockedCount }: { view: RosterGalleryView; lockedCount: number }) {
  if (lockedCount === 0 && view.photos.length > 0) {
    return (
      <div className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-emerald-400">
        <ShieldCheck className="size-4" aria-hidden="true" />
        {view.billingMode === "parent_pay" ? `Purchased · ${view.bundle?.tierName ?? "Full gallery"}` : "Unlocked · downloads included"}
      </div>
    )
  }
  return (
    <div className={`flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.22em] ${view.awaitingTeamBalance ? "text-amber-400" : "text-fuchsia-400"}`}>
      <LockKeyhole className="size-4" aria-hidden="true" /> Locked
    </div>
  )
}

export function RosterGallery({ view, notice }: { view: RosterGalleryView; notice?: string | null }) {
  const router = useRouter()
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const lockedCount = Math.max(0, view.photoCount - view.photos.length)
  const isTeamFolder = view.scope === "team"

  async function downloadAll() {
    setDownloading(true)
    setError(null)
    try {
      const zip = new JSZip()
      const results = await Promise.all(view.photos.map(async (photo) => {
        const response = await fetch(photo.downloadUrl)
        if (!response.ok) throw new Error("A high-resolution photo could not be downloaded. Refresh the page and try again.")
        return { name: photo.fileName, blob: await response.blob() }
      }))
      for (const item of results) zip.file(item.name, item.blob)
      const archive = await zip.generateAsync({ type: "blob", compression: "STORE" })
      const url = URL.createObjectURL(archive)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `${view.title.replace(/[^a-z0-9-]+/gi, "-")}-high-res-gallery.zip`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Could not download the gallery.")
    } finally {
      setDownloading(false)
    }
  }

  function buyBundle() {
    if (!view.playerId) return
    const playerId = view.playerId
    setError(null)
    startTransition(async () => {
      const result = await startRosterGalleryCheckout(playerId)
      if (!result.success) {
        setError(result.error)
        return
      }
      if (result.paid) {
        router.refresh()
        return
      }
      window.location.assign(result.url)
    })
  }

  function signOut() {
    startTransition(async () => {
      await logoutRosterVault()
      router.replace("/vault/roster")
      router.refresh()
    })
  }

  const lockedMessage = view.viewerIsPlayer
    ? "Your team organizer controls when photos are released. They will appear here as soon as your gallery is unlocked."
    : view.awaitingTeamBalance
      ? "These photos unlock as soon as your team's package is paid. Your organizer will let you know when they are ready."
      : view.bundle
        ? "Pay once to see and download every photo in full resolution, then order prints if you like."
        : "This gallery is not available to unlock yet. Please contact your team organizer."

  return (
    <div className="min-h-svh bg-[#09090b] text-zinc-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 pb-20 pt-28 sm:px-8 sm:pt-32">
        <header className="flex flex-wrap items-start justify-between gap-5 border-b border-zinc-800 pb-6">
          <div className="flex flex-col gap-3">
            {view.viewerIsPlayer ? (
              <Button type="button" variant="outline" size="sm" className="w-fit" onClick={signOut} disabled={pending}>
                <LogOut className="size-4" aria-hidden="true" /> Sign out
              </Button>
            ) : (
              <Link href="/vault/roster" className="inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-fuchsia-400">
                <ArrowLeft className="size-4" aria-hidden="true" /> Back to roster
              </Link>
            )}
            <StatusBadge view={view} lockedCount={lockedCount} />
            <p className="text-sm text-zinc-500">{view.teamName} <span className="px-1.5 text-zinc-700">/</span> {isTeamFolder ? "TEAM FOLDER" : "PLAYER GALLERY"}</p>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl">{view.title}</h1>
            <p className="text-sm text-zinc-400">
              {view.jerseyNumber ? `#${view.jerseyNumber} · ` : ""}
              {view.photoCount === 0
                ? "photos are being prepared"
                : lockedCount === 0
                  ? `${photoCountLabel(view.photoCount)} · high-resolution and ready to download`
                  : view.photos.length > 0
                    ? `${view.photos.length} of ${view.photoCount} photos unlocked`
                    : `${photoCountLabel(view.photoCount)} waiting to be unlocked`}
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-64">
            {view.photos.length > 0 ? (
              <Button type="button" onClick={downloadAll} disabled={downloading} className="h-11 bg-fuchsia-600 font-semibold text-white hover:bg-fuchsia-500 disabled:bg-zinc-800 disabled:text-zinc-500">
                <Download className="size-4" aria-hidden="true" />
                {downloading ? "Preparing high-res files…" : "Download All (High-Res)"}
              </Button>
            ) : null}
            {view.playerId && !view.viewerIsPlayer && view.photos.length > 0 ? (
              <RosterPrintOrderDialog
                gallery={{ playerId: view.playerId, playerName: view.title, photos: view.photos, printProducts: view.printProducts }}
              />
            ) : null}
          </div>
        </header>

        {notice ? <p role="status" className="rounded-lg border border-emerald-900/60 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-100">{notice}</p> : null}
        {error ? <p role="alert" className="rounded-lg border border-rose-900/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">{error}</p> : null}

        {lockedCount > 0 ? (
          <section aria-labelledby="gallery-locked-heading" className="flex flex-col items-start gap-5 rounded-2xl border border-zinc-800 bg-[#111114] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div className="flex items-start gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-fuchsia-500/10 text-fuchsia-400">
                <LockKeyhole className="size-6" aria-hidden="true" />
              </span>
              <div className="flex max-w-xl flex-col gap-1.5">
                <h2 id="gallery-locked-heading" className="font-heading text-xl font-semibold text-white">
                  {photoCountLabel(lockedCount)} {lockedCount === 1 ? "is" : "are"} ready and locked
                </h2>
                <p className="text-sm leading-relaxed text-zinc-400">{lockedMessage}</p>
              </div>
            </div>
            {view.bundle ? (
              <Button type="button" onClick={buyBundle} disabled={pending} className="h-11 w-full bg-fuchsia-600 font-semibold text-white hover:bg-fuchsia-500 disabled:bg-zinc-800 disabled:text-zinc-500 sm:w-auto">
                <ShoppingCart className="size-4" aria-hidden="true" />
                {pending ? "Opening checkout…" : `Unlock gallery · ${formatCents(view.bundle.priceCents)}`}
              </Button>
            ) : null}
          </section>
        ) : null}

        {view.photoCount === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/60 px-6 text-center">
            <ImageOff className="size-8 text-zinc-600" aria-hidden="true" />
            <h2 className="font-heading text-lg font-semibold text-white">Photos are being prepared</h2>
            <p className="max-w-sm text-sm leading-relaxed text-zinc-500">The team will add finished images here soon.</p>
          </div>
        ) : view.photos.length > 0 ? (
          <ul className="columns-1 gap-3 sm:columns-2 sm:gap-4 lg:columns-3" aria-label={`${view.title} gallery`}>
            {view.photos.map((photo) => (
              <li key={photo.id} className="group relative mb-3 break-inside-avoid overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 sm:mb-4">
                {/* eslint-disable-next-line @next/next/no-img-element -- temporary signed private Storage URL */}
                <img src={photo.imageUrl} alt={photo.altText} loading="lazy" decoding="async" className="block h-auto w-full" />
                <a
                  href={photo.downloadUrl}
                  download={photo.fileName}
                  aria-label={`Download ${photo.altText}`}
                  className="absolute bottom-3 right-3 inline-flex h-9 items-center gap-2 rounded-full bg-black/80 px-3 text-xs font-semibold text-white backdrop-blur-sm transition-colors hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-400"
                >
                  <Download className="size-3.5" aria-hidden="true" /> Download
                </a>
              </li>
            ))}
          </ul>
        ) : null}

        <p className="flex items-center justify-center gap-2 border-t border-zinc-900 pt-5 text-xs text-zinc-600">
          <LockKeyhole className="size-3.5" aria-hidden="true" /> Private gallery — photos are released only after a parent purchase, team payment, or a prepaid team package.
        </p>
      </div>
    </div>
  )
}
