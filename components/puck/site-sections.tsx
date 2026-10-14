"use client"

import { createContext, useContext, type ReactNode } from "react"

import { CoreIdentitySection } from "@/components/home/core-identity-section"
import { DisciplinesSection } from "@/components/home/disciplines-section"
import { DualSplitSection } from "@/components/home/dual-split-section"
import type { SiteSlotOverrides } from "@/lib/site-slots"

const SiteSlotsContext = createContext<SiteSlotOverrides>({})

/** Hands the saved homepage image overrides to the section blocks, in the editor and on the live page alike. */
export function SiteSlotsProvider({ overrides, children }: { overrides: SiteSlotOverrides; children: ReactNode }) {
  return <SiteSlotsContext.Provider value={overrides}>{children}</SiteSlotsContext.Provider>
}

export function StudioBlock() {
  return <CoreIdentitySection overrides={useContext(SiteSlotsContext)} />
}

export function DualSplitBlock() {
  return <DualSplitSection overrides={useContext(SiteSlotsContext)} />
}

export function DisciplinesBlock() {
  return <DisciplinesSection overrides={useContext(SiteSlotsContext)} />
}
