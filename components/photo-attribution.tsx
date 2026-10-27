import Link from "next/link"
import { Camera, Laptop } from "lucide-react"

import { cn } from "@/lib/utils"

type PhotoAttributionProps = {
  shotBy?: string | null
  editedBy?: string | null
  shotByHref?: string
  onNavigate?: () => void
  className?: string
}

/** "Shot By | Edited By" credit line. Renders nothing when neither name is set. */
export function PhotoAttribution({ shotBy, editedBy, shotByHref, onNavigate, className }: PhotoAttributionProps) {
  if (!shotBy && !editedBy) return null

  return (
    <p className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-300", className)}>
      {shotBy ? (
        <span className="inline-flex items-center gap-1.5">
          <Camera className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="sr-only">Shot by</span>
          {shotByHref ? (
            <Link
              href={shotByHref}
              onClick={onNavigate}
              className="font-medium text-[#FF00FF] underline-offset-4 hover:underline"
            >
              {shotBy}
            </Link>
          ) : (
            <span>{shotBy}</span>
          )}
        </span>
      ) : null}
      {shotBy && editedBy ? (
        <span aria-hidden="true" className="text-zinc-600">
          |
        </span>
      ) : null}
      {editedBy ? (
        <span className="inline-flex items-center gap-1.5">
          <Laptop className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="sr-only">Edited by</span>
          <span>{editedBy}</span>
        </span>
      ) : null}
    </p>
  )
}
