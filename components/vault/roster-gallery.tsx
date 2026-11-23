"use client"

import { useState, useTransition } from "react"
import JSZip from "jszip"
import { ArrowLeft, Download, ImageOff, LockKeyhole, ShieldCheck, ShoppingCart } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import type { RosterGalleryPhoto, RosterGalleryView } from "@/app/actions/roster-vault"
import { startRosterGalleryCheckout, startRosterPhotoCheckout } from "@/app/actions/roster-vault-payments"
import { Button } from "@/components/ui/button"
import { RosterPrintOrderDialog } from "@/components/vault/roster-print-order-dialog"

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
const formatCents = (cents: number) => currency.format(cents / 100)

function StatusBadge({ view }: { view: RosterGalleryView }) {
  if (view.allUnlocked) {
    return (
      <div className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-emerald-400">
        <ShieldCheck className="size-4" aria-hidden="true" />
        {view.billingMode === "all_inclusive" ? "Downloads included with your team package" : `Purchased · ${view.bundle?.tierName ?? "Full gallery"}`}
      </div>
    )
  }
  if (view.awaitingTeamBalance) {
    return (
      <div className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-amber-400">
        <LockKeyhole className="size-4" aria-hidden="true" /> Proofs only · downloads unlock when your team&apos;s package is paid
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-fuchsia-400">
      <LockKeyhole className="size-4" aria-hidden="true" /> Watermarked proofs
    </div>
  )
}

export function RosterGallery({ view, notice }: { view: RosterGalleryView; notice?: string | null }) {
  const router = useRouter()
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [pendingPhotoId, setPendingPhotoId] = useState<string | null>(null)

  const unlockedPhotos = view.photos.filter((photo) => photo.unlocked)
  const isTeamFolder = view.scope === "team"

  async function downloadAll() {
    setDownloading(true)
    setError(null)
    try {
      const zip = new JSZip()
      const results = await Promise.all(unlockedPhotos.map(async (photo) => {
        const response = await fetch(photo.imageUrl)
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

  function buyPhoto(photo: RosterGalleryPhoto) {
    setError(null)
    setPendingPhotoId(photo.id)
    startTransition(async () => {
      const result = await startRosterPhotoCheckout({ photoKind: view.scope, photoId: photo.id })
      if (!result.success) {
        setError(result.error)
        setPendingPhotoId(null)
        return
      }
      if (result.paid) {
        setPendingPhotoId(null)
        router.refresh()
        return
      }
      window.location.assign(result.url)
    })
  }

  return (
    <div className="min-h-svh bg-[#09090b] text-zinc-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 pb-20 pt-8 sm:px-8 sm:pt-12">
        <header className="flex flex-wrap items-start justify-between gap-5 border-b border-zinc-800 pb-6">
          <div className="flex flex-col gap-3">
            <Link href="/vault/roster" className="inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-fuchsia-400">
              <ArrowLeft className="size-4" aria-hidden="true" /> Back to roster
            </Link>
            <StatusBadge view={view} />
            <p className="text-sm text-zinc-500">{view.teamName} <span className="px-1.5 text-zinc-700">/</span> {isTeamFolder ? "TEAM FOLDER" : "PLAYER GALLERY"}</p>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl">{view.title}</h1>
            <p className="text-sm text-zinc-400">
              {view.jerseyNumber ? `#${view.jerseyNumber} · ` : ""}
              {view.allUnlocked
                ? "watermark-free high-resolution images"
                : view.awaitingTeamBalance
                  ? "browse the watermarked proofs while your team finishes its package payment"
                  : unlockedPhotos.length > 0
                    ? `${unlockedPhotos.length} of ${view.photos.length} photos unlocked`
                    : "preview the watermarked proofs, then unlock the high-resolution files"}
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-64">
            {view.allUnlocked ? (
              <Button type="button" onClick={downloadAll} disabled={downloading || unlockedPhotos.length === 0} className="h-11 bg-fuchsia-600 font-semibold text-white hover:bg-fuchsia-500 disabled:bg-zinc-800 disabled:text-zinc-500">
                <Download className="size-4" aria-hidden="true" />
                {downloading ? "Preparing high-res files…" : "Download All (High-Res)"}
              </Button>
            ) : view.bundle ? (
              <Button type="button" onClick={buyBundle} disabled={pending} className="h-11 bg-fuchsia-600 font-semibold text-white hover:bg-fuchsia-500 disabled:bg-zinc-800 disabled:text-zinc-500">
                <ShoppingCart className="size-4" aria-hidden="true" />
                {pending && !pendingPhotoId ? "Opening checkout…" : `Full digital bundle · ${formatCents(view.bundle.priceCents)}`}
              </Button>
            ) : unlockedPhotos.length > 0 ? (
              <Button type="button" onClick={downloadAll} disabled={downloading} className="h-11 bg-fuchsia-600 font-semibold text-white hover:bg-fuchsia-500 disabled:bg-zinc-800 disabled:text-zinc-500">
                <Download className="size-4" aria-hidden="true" />
                {downloading ? "Preparing high-res files…" : `Download purchased (${unlockedPhotos.length})`}
              </Button>
            ) : null}
            {view.playerId ? (
              <RosterPrintOrderDialog
                gallery={{ playerId: view.playerId, playerName: view.title, photos: view.photos, printProducts: view.printProducts }}
              />
            ) : null}
          </div>
        </header>

        {notice ? <p role="status" className="rounded-lg border border-emerald-900/60 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-100">{notice}</p> : null}
        {error ? <p role="alert" className="rounded-lg border border-rose-900/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">{error}</p> : null}

        {view.photos.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/60 px-6 text-center">
            <ImageOff className="size-8 text-zinc-600" aria-hidden="true" />
            <h2 className="font-heading text-lg font-semibold text-white">Photos are being prepared</h2>
            <p className="max-w-sm text-sm leading-relaxed text-zinc-500">The team will add finished images here soon.</p>
          </div>
        ) : (
          <ul className="columns-1 gap-3 sm:columns-2 sm:gap-4 lg:columns-3" aria-label={`${view.title} gallery`}>
            {view.photos.map((photo) => (
              <li key={photo.id} className="group relative mb-3 break-inside-avoid overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 sm:mb-4">
                {/* eslint-disable-next-line @next/next/no-img-element -- temporary signed private Storage URL */}
                <img src={photo.imageUrl} alt={photo.altText} loading="lazy" decoding="async" className="block h-auto w-full" />
                {photo.unlocked ? (
                  <a
                    href={photo.imageUrl}
                    download={photo.fileName}
                    aria-label={`Download ${photo.altText}`}
                    className="absolute bottom-3 right-3 inline-flex h-9 items-center gap-2 rounded-full bg-black/80 px-3 text-xs font-semibold text-white backdrop-blur-sm transition-colors hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-400"
                  >
                    <Download className="size-3.5" aria-hidden="true" /> Download
                  </a>
                ) : view.singlePhotoPriceCents ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => buyPhoto(photo)}
                    disabled={pending}
                    aria-label={`Buy a high-resolution download of ${photo.altText} for ${formatCents(view.singlePhotoPriceCents)}`}
                    className="absolute bottom-3 right-3 h-9 rounded-full bg-fuchsia-600 px-3 text-xs font-semibold text-white shadow-lg hover:bg-fuchsia-500"
                  >
                    <ShoppingCart className="size-3.5" aria-hidden="true" />
                    {pendingPhotoId === photo.id ? "Opening…" : `Download · ${formatCents(view.singlePhotoPriceCents)}`}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <p className="flex items-center justify-center gap-2 border-t border-zinc-900 pt-5 text-xs text-zinc-600">
          <LockKeyhole className="size-3.5" aria-hidden="true" /> Private gallery — high-resolution files are only released to this signed-in team member after purchase or team payment.
        </p>
      </div>
    </div>
  )
}
