"use client"

import { createContext, useContext, type ReactNode } from "react"

import { CoreIdentitySection, type StudioText } from "@/components/home/core-identity-section"
import {
  DisciplinesSection,
  type DisciplineFrames,
  type DisciplineHrefs,
  type DisciplineImages,
  type DisciplinesText,
} from "@/components/home/disciplines-section"
import {
  DualSplitSection,
  type DualSplitFrames,
  type DualSplitImages,
  type DualSplitText,
} from "@/components/home/dual-split-section"
import { HeroCarousel3D, type HeroPhoto } from "@/components/home/hero-carousel-3d"
import type { SiteSlotOverrides } from "@/lib/site-slots"

const SiteSlotsContext = createContext<SiteSlotOverrides>({})

/** Hands the saved homepage image overrides to the section blocks, in the editor and on the live page alike. */
export function SiteSlotsProvider({ overrides, children }: { overrides: SiteSlotOverrides; children: ReactNode }) {
  return <SiteSlotsContext.Provider value={overrides}>{children}</SiteSlotsContext.Provider>
}

export function HeroBlock({ photos }: { photos: HeroPhoto[] }) {
  return <HeroCarousel3D photos={photos} />
}

export function StudioBlock({ text }: { text?: StudioText }) {
  return <CoreIdentitySection text={text} />
}

export function DualSplitBlock({
  images,
  frames,
  text,
}: {
  images: DualSplitImages
  frames?: DualSplitFrames
  text?: DualSplitText
}) {
  return <DualSplitSection overrides={useContext(SiteSlotsContext)} images={images} frames={frames} text={text} />
}

export function DisciplinesBlock({
  images,
  frames,
  hrefs,
  text,
}: {
  images: DisciplineImages
  frames?: DisciplineFrames
  hrefs?: DisciplineHrefs
  text?: DisciplinesText
}) {
  // Puck passes contentEditable text fields as React elements inside the editor, so only strings can be trimmed.
  const heading = text?.heading
  const hasHeading = typeof heading === "string" ? heading.trim() !== "" : Boolean(heading)

  return (
    <DisciplinesSection
      overrides={useContext(SiteSlotsContext)}
      images={images}
      frames={frames}
      hrefs={hrefs}
      text={{ ...text, heading: hasHeading ? heading : undefined }}
    />
  )
}
