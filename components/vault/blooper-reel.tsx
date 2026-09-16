"use client"

import Image from "next/image"
import { PartyPopper } from "lucide-react"

const BLOOPERS = [
  { src: "/images/gallery-automotive-2.png", caption: "Take 14: the drone almost hit the garage door." },
  { src: "/images/gallery-sports-2.png", caption: "Nobody told the mascot the shoot started early." },
  { src: "/images/gallery-portrait-2.png", caption: "\"One more, I promise\" — said 40 photos ago." },
  { src: "/images/gallery-events-2.png", caption: "The confetti cannon was NOT supposed to fire yet." },
]

export function BlooperReel() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 text-center">
      <div className="flex flex-col items-center gap-2">
        <PartyPopper className="h-8 w-8 text-primary" />
        <h1 className="font-serif text-2xl text-foreground">You Found the Secret Vault</h1>
        <p className="text-sm text-muted-foreground">
          There&apos;s no client here — just the outtakes we don&apos;t usually show.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {BLOOPERS.map((b) => (
          <figure key={b.src} className="flex flex-col gap-2 overflow-hidden rounded-xl border border-border">
            <div className="relative aspect-[4/5] w-full bg-muted">
              <Image src={b.src} alt="" fill sizes="200px" className="object-cover grayscale" crossOrigin="anonymous" />
            </div>
            <figcaption className="px-2 pb-2 text-left text-xs text-muted-foreground">{b.caption}</figcaption>
          </figure>
        ))}
      </div>
      <p className="text-xs text-muted-foreground/70">Shh. Keep this between us.</p>
    </div>
  )
}
