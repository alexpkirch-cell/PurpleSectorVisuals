import { FileText } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { SignedContract } from "@/app/actions/legal"

function formatDate(value: string | null) {
  if (!value) return "Unsigned"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  })
}

export function LegalHubTable({ contracts }: { contracts: SignedContract[] }) {
  if (contracts.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No signed liability releases yet.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {contracts.map((contract) => (
        <div
          key={contract.id}
          className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary">
              <FileText className="size-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{contract.client_name ?? "Unknown client"}</p>
              <p className="text-xs text-muted-foreground">
                {contract.client_email} &middot; Vault {contract.pin_code}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground sm:justify-end">
            {contract.package_title && <Badge variant="secondary">{contract.package_title}</Badge>}
            <span className="italic text-foreground">&ldquo;{contract.client_signature}&rdquo;</span>
            <span>Signed {formatDate(contract.signed_at)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
