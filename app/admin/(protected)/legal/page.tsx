import type { Metadata } from "next"

import { listLegalDocuments, listSignedContracts } from "@/app/actions/legal"
import { LegalDocuments } from "@/components/admin/legal-documents"
import { LegalHubTable } from "@/components/admin/legal-hub-table"

export const metadata: Metadata = {
  title: "Legal Hub | Purple Sector Visuals",
  robots: { index: false, follow: false },
}

export default async function AdminLegalPage() {
  const [contracts, documents] = await Promise.all([listSignedContracts(), listLegalDocuments()])

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-medium text-foreground">Legal Hub</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every signed liability release, tied back to its client vault and package.
        </p>
      </div>

      <LegalHubTable contracts={contracts} />

      <div>
        <h2 className="mb-1 font-heading text-sm font-medium text-foreground">Business Documents</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Corporate filings, model releases, and contractor W-9s in one secure vault.
        </p>
        <LegalDocuments initialDocuments={documents} />
      </div>
    </div>
  )
}
