import type { ReactNode } from "react"

import { EditableImage, EditOnly } from "@/components/puck/inline-edit"

export const SPECIALTY_TYPES = [
  "Portraits",
  "Athletics",
  "Automotive",
  "Events",
  "Brand & Commercial",
] as const

export const CUSTOM_SPECIALTY = "custom"

export type SpecialtyType = (typeof SPECIALTY_TYPES)[number] | typeof CUSTOM_SPECIALTY

export const SPECIALTY_OPTIONS = [
  ...SPECIALTY_TYPES.map((value) => ({ label: value, value })),
  { label: "Custom...", value: CUSTOM_SPECIALTY },
]

export function resolveSpecialtyName(specialtyType: SpecialtyType, customSpecialtyName?: string) {
  if (specialtyType === CUSTOM_SPECIALTY) return customSpecialtyName?.trim() || "Your specialty"
  return specialtyType
}

type SpecialtyBlockProps = {
  name: string
  description: ReactNode
  image: string
  imageAlt: string
}

export function SpecialtyBlock({ name, description, image, imageAlt }: SpecialtyBlockProps) {
  return (
    <section className="w-full bg-[#09090b]">
      <div
        className={
          image
            ? "mx-auto grid max-w-6xl items-center gap-10 px-6 py-20 sm:px-10 md:grid-cols-2"
            : "mx-auto flex max-w-3xl flex-col px-6 py-20 sm:px-10"
        }
      >
        {image ? (
          <EditableImage path="image">
            <div className="w-full overflow-hidden rounded-3xl border border-zinc-800 shadow-2xl shadow-black/60">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt={imageAlt} className="block h-auto w-full object-contain" />
            </div>
          </EditableImage>
        ) : (
          <EditOnly>
            <EditableImage path="image">
              <div className="mb-8 flex h-40 w-full items-center justify-center rounded-3xl border border-dashed border-zinc-700 bg-zinc-900/60 text-sm text-zinc-400">
                Click to add a photo (optional)
              </div>
            </EditableImage>
          </EditOnly>
        )}
        <div className="flex flex-col">
          <p className="font-heading text-xs font-semibold uppercase tracking-[0.3em] text-[#e829f1]">Specialty</p>
          <h2 className="mt-4 text-balance font-heading text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            {name}
          </h2>
          {description ? (
            <p className="mt-6 text-pretty text-base leading-relaxed text-zinc-400">{description}</p>
          ) : null}
        </div>
      </div>
    </section>
  )
}
