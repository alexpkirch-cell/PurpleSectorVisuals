import type { Metadata } from "next"
import Image from "next/image"
import { Download } from "lucide-react"

import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Demo Gallery | Purple Sector Visuals",
  description: "A sample client vault gallery preview.",
}

const demoPhotos = Array.from({ length: 6 }, (_, i) => `/placeholders/${i + 1}.jpg`)

export default function VaultDemoPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-16 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <div className="flex flex-col gap-2">
          <span className="font-heading text-xs font-bold tracking-[0.18em] text-primary">DEMO VAULT</span>
          <h1 className="font-heading text-2xl font-medium text-zinc-50 sm:text-3xl">Jordan Rivera&apos;s Gallery</h1>
          <p className="max-w-xl text-sm text-zinc-400">
            This is a sample preview of what a delivered client vault looks like. Real galleries include
            full-resolution downloads for every image.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {demoPhotos.map((src, index) => (
            <div
              key={src}
              className="group relative aspect-[4/5] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900"
            >
              <Image
                src={src}
                alt={`Sample delivered photo ${index + 1}`}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
              <div className="absolute inset-0 flex items-end justify-end bg-gradient-to-t from-black/60 via-transparent to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
                <Button size="icon" variant="secondary" aria-label={`Download photo ${index + 1}`}>
                  <Download />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
