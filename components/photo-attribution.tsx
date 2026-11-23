import Link from "next/link"
import { Camera, Laptop } from "lucide-react"

import { profileHrefFor } from "@/lib/shooter-link"
import { cn } from "@/lib/utils"

type PhotoAttributionProps = {
  /** One name or several separated by commas; each person links to their own profile. */
  shotBy?: string | null
  editedBy?: string | null
  onNavigate?: () => void
  className?: string
}

function splitCredits(value: string | null | undefined) {
  return (value ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
}

function CreditNames({ names, onNavigate }: { names: string[]; onNavigate?: () => void }) {
  return names.map((name, index) => {
    const href = profileHrefFor(name)
    return (
      <span key={`${name}-${index}`}>
        {href ? (
          <Link
            href={href}
            onClick={onNavigate}
            className="font-medium text-[#FF00FF] underline-offset-4 hover:underline"
          >
            {name}
          </Link>
        ) : (
          <span>{name}</span>
        )}
        {index < names.length - 1 ? <span aria-hidden="true">,</span> : null}
      </span>
    )
  })
}

/** "Shot By | Edited By" credit line. Renders nothing when neither name is set. */
export function PhotoAttribution({ shotBy, editedBy, onNavigate, className }: PhotoAttributionProps) {
  const shooters = splitCredits(shotBy)
  const editors = splitCredits(editedBy)
  if (shooters.length === 0 && editors.length === 0) return null

  return (
    <p className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-300", className)}>
      {shooters.length > 0 ? (
        <span className="inline-flex flex-wrap items-center gap-x-1.5">
          <Camera className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="sr-only">Shot by</span>
          <span className="inline-flex flex-wrap gap-x-1">
            <CreditNames names={shooters} onNavigate={onNavigate} />
          </span>
        </span>
      ) : null}
      {shooters.length > 0 && editors.length > 0 ? (
        <span aria-hidden="true" className="text-zinc-600">
          |
        </span>
      ) : null}
      {editors.length > 0 ? (
        <span className="inline-flex flex-wrap items-center gap-x-1.5">
          <Laptop className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="sr-only">Edited by</span>
          <span className="inline-flex flex-wrap gap-x-1">
            <CreditNames names={editors} onNavigate={onNavigate} />
          </span>
        </span>
      ) : null}
    </p>
  )
}
