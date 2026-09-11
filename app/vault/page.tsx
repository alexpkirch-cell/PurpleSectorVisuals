import type { Metadata } from "next"

import { AccessKeyForm } from "@/components/vault/access-key-form"

export const metadata: Metadata = {
  title: "Client Vault | Purple Sector Visuals",
  description: "Access your edited photo gallery from Purple Sector Visuals.",
}

export default function VaultLandingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8">
        <div className="mb-6 flex flex-col gap-1">
          <span className="font-heading text-xs font-bold tracking-[0.18em] text-muted-foreground">
            PURPLE SECTOR VISUALS
          </span>
          <h1 className="font-heading text-xl font-medium text-foreground">Client Vault</h1>
          <p className="text-sm text-muted-foreground">
            Enter the access key your photographer sent you to view and download your edited
            photos.
          </p>
        </div>
        <AccessKeyForm />
      </div>
    </main>
  )
}
