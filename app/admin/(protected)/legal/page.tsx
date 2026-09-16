import type { Metadata } from "next"

import { listSignedContracts } from "@/app/actions/legal"
import { LegalHubTable } from "@/components/admin/legal-hub-table"

export const metadata: Metadata = {
  title: "Legal Hub | Purple Sector Visuals",
  robots: { index: false, follow: false },
}

export default async function AdminLegalPage() {
  const contracts = await listSignedContracts()

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-medium text-foreground">Legal Hub</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every signed liability release, tied back to its client vault and package.
        </p>
      </div>

      <LegalHubTable contracts={contracts} />
    </div>
  )
}
