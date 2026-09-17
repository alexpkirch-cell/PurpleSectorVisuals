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
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-[90%] rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-md sm:w-full sm:max-w-md sm:p-8">
        <div className="mb-6 flex flex-col gap-1">
          <span className="font-heading text-xs font-bold tracking-[0.18em] text-zinc-500">
            PURPLE SECTOR VISUALS
          </span>
          <h1 className="font-heading text-xl font-medium text-zinc-50">Client Vault</h1>
          <p className="text-sm text-zinc-400">
            Have a booking PIN? Unlock your session vault to sign your agreement, secure your retainer, and
            eventually view your gallery.
          </p>
        </div>
        <PinEntryForm />
        <div className="my-6 flex items-center gap-3">
          <Separator className="flex-1 bg-zinc-800" />
          <span className="text-xs text-zinc-500">OR</span>
          <Separator className="flex-1 bg-zinc-800" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm text-zinc-400">
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
