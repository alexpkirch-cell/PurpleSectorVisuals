"use client"

import { createContext, useContext, type ReactNode } from "react"

import { CoreIdentitySection, type CoreIdentityImages } from "@/components/home/core-identity-section"
import { DisciplinesSection, type DisciplineImages } from "@/components/home/disciplines-section"
import { DualSplitSection, type DualSplitImages } from "@/components/home/dual-split-section"
import { HeroCarousel3D } from "@/components/home/hero-carousel-3d"
import type { SiteSlotOverrides } from "@/lib/site-slots"

const SiteSlotsContext = createContext<SiteSlotOverrides>({})

/** Hands the saved homepage image overrides to the section blocks, in the editor and on the live page alike. */
export function SiteSlotsProvider({ overrides, children }: { overrides: SiteSlotOverrides; children: ReactNode }) {
  return <SiteSlotsContext.Provider value={overrides}>{children}</SiteSlotsContext.Provider>
}

export function HeroBlock({ images }: { images: (string | undefined)[] }) {
  return <HeroCarousel3D images={images} />
}

export function StudioBlock({ images }: { images: CoreIdentityImages }) {
  return <CoreIdentitySection overrides={useContext(SiteSlotsContext)} images={images} />
}

export function DualSplitBlock({ images }: { images: DualSplitImages }) {
  return <DualSplitSection overrides={useContext(SiteSlotsContext)} images={images} />
}

export function DisciplinesBlock({ images }: { images: DisciplineImages }) {
  return <DisciplinesSection overrides={useContext(SiteSlotsContext)} images={images} />
}
