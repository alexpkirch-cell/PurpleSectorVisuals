import type { Metadata } from "next"

import { AccessKeyForm } from "@/components/vault/access-key-form"
import { PinEntryForm } from "@/components/vault/pin-entry-form"
import { Separator } from "@/components/ui/separator"

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
            Have a booking PIN? Unlock your session vault to sign your agreement, secure your retainer, and
            eventually view your gallery.
          </p>
        </div>
        <PinEntryForm />
        <div className="my-6 flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">OR</span>
          <Separator className="flex-1" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">
            Have an access key from a delivered gallery instead? Enter it below.
          </p>
        </div>
        <div className="mt-3">
          <AccessKeyForm />
        </div>
      </div>
    </main>
  )
}
