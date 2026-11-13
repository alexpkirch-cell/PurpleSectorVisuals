"use client"

import { useState } from "react"
import JSZip from "jszip"
import { ArrowLeft, Download, ImageOff, LockKeyhole, Printer, ShieldCheck } from "lucide-react"
import Link from "next/link"

import type { UnlockedRosterGallery } from "@/app/actions/roster-vault"
import { Button } from "@/components/ui/button"

export function RosterGallery({ gallery }: { gallery: UnlockedRosterGallery }) {
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  async function downloadAll() {
    setDownloading(true)
    setDownloadError(null)
    try {
      const zip = new JSZip()
      const results = await Promise.all(gallery.photos.map(async (photo) => {
        const response = await fetch(photo.imageUrl)
        if (!response.ok) throw new Error("A high-resolution photo could not be downloaded. Refresh the page and try again.")
        return { name: photo.fileName, blob: await response.blob() }
      }))
      for (const item of results) zip.file(item.name, item.blob)
      const archive = await zip.generateAsync({ type: "blob", compression: "STORE" })
      const url = URL.createObjectURL(archive)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `${gallery.playerName.replace(/[^a-z0-9-]+/gi, "-")}-high-res-gallery.zip`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Could not download the gallery.")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="min-h-svh bg-[#09090b] text-zinc-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 pb-20 pt-8 sm:px-8 sm:pt-12">
        <header className="flex flex-wrap items-start justify-between gap-5 border-b border-zinc-800 pb-6">
          <div className="flex flex-col gap-3">
            <Link href="/vault/roster" className="inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-fuchsia-400">
              <ArrowLeft className="size-4" aria-hidden="true" /> Back to roster
            </Link>
            <div className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-emerald-400">
              <ShieldCheck className="size-4" aria-hidden="true" /> Purchased · {gallery.tierName}
            </div>
            <p className="text-sm text-zinc-500">{gallery.teamName} <span className="px-1.5 text-zinc-700">/</span> PLAYER GALLERY</p>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl">{gallery.playerName}</h1>
            <p className="text-sm text-zinc-400">#{gallery.jerseyNumber} · watermark-free high-resolution images</p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-64">
            <Button type="button" onClick={downloadAll} disabled={downloading || gallery.photos.length === 0} className="h-11 bg-fuchsia-600 font-semibold text-white hover:bg-fuchsia-500 disabled:bg-zinc-800 disabled:text-zinc-500">
              <Download className="size-4" aria-hidden="true" />
              {downloading ? "Preparing high-res files…" : "Download All (High-Res)"}
            </Button>
            <Button type="button" disabled className="h-11 cursor-not-allowed border border-zinc-700 bg-zinc-900 text-zinc-300 opacity-100" aria-label="Order professional prints, coming soon">
              <Printer className="size-4" aria-hidden="true" />
              Order Professional Prints
            </Button>
            <span className="text-center text-[0.65rem] uppercase tracking-[0.16em] text-zinc-600">Print ordering coming soon</span>
          </div>
        </header>

        {downloadError ? <p role="alert" className="rounded-lg border border-rose-900/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">{downloadError}</p> : null}

        {gallery.photos.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/60 px-6 text-center">
            <ImageOff className="size-8 text-zinc-600" aria-hidden="true" />
            <h2 className="font-heading text-lg font-semibold text-white">Gallery images are being prepared</h2>
            <p className="max-w-sm text-sm leading-relaxed text-zinc-500">Your purchase is confirmed. The team will add the finished images here soon.</p>
          </div>
        ) : (
          <ul className="columns-1 gap-3 sm:columns-2 sm:gap-4 lg:columns-3" aria-label={`${gallery.playerName} high-resolution gallery`}>
            {gallery.photos.map((photo) => (
              <li key={photo.id} className="mb-3 break-inside-avoid overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 sm:mb-4">
                {/* eslint-disable-next-line @next/next/no-img-element -- temporary signed private Storage URL */}
                <img src={photo.imageUrl} alt={photo.altText} loading="lazy" decoding="async" className="block h-auto w-full" />
              </li>
            ))}
          </ul>
        )}

        <p className="flex items-center justify-center gap-2 border-t border-zinc-900 pt-5 text-xs text-zinc-600">
          <LockKeyhole className="size-3.5" aria-hidden="true" /> Private gallery — original files are available to this signed-in purchaser.
        </p>
      </div>
    </div>
  )
}
