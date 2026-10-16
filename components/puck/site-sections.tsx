"use client"

import { createContext, useContext, type ComponentProps, type ReactNode } from "react"

import { CreatorPage } from "@/components/creator-page"
import { CoreIdentitySection, type CoreIdentityImages } from "@/components/home/core-identity-section"
import { DisciplinesSection, type DisciplineHrefs, type DisciplineImages } from "@/components/home/disciplines-section"
import { DualSplitSection, type DualSplitImages } from "@/components/home/dual-split-section"
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

export function StudioBlock({ images }: { images: CoreIdentityImages }) {
  return <CoreIdentitySection overrides={useContext(SiteSlotsContext)} images={images} />
}

export function DualSplitBlock({ images }: { images: DualSplitImages }) {
  return <DualSplitSection overrides={useContext(SiteSlotsContext)} images={images} />
}

export function CreatorBlock(props: Omit<ComponentProps<typeof CreatorPage>, "overrides">) {
  return <CreatorPage {...props} overrides={useContext(SiteSlotsContext)} />
}

export function DisciplinesBlock({ images, hrefs }: { images: DisciplineImages; hrefs?: DisciplineHrefs }) {
  return <DisciplinesSection overrides={useContext(SiteSlotsContext)} images={images} hrefs={hrefs} />
}
