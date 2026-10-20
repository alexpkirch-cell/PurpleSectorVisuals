import type { Metadata } from "next"

import { VaultLoginForm } from "@/components/shoot-vault/vault-login-form"

export const metadata: Metadata = {
  title: "Shoot Vault | Purple Sector Visuals",
  description: "Access your shoot's photos with your email and vault access code.",
}

export default function ShootVaultLandingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8">
        <div className="mb-6 flex flex-col gap-1">
          <span className="font-heading text-xs font-bold tracking-[0.18em] text-muted-foreground">
            PURPLE SECTOR VISUALS
          </span>
          <h1 className="font-heading text-xl font-medium text-foreground">Shoot vault</h1>
          <p className="text-sm text-muted-foreground">
            Enter your email and the vault access code from your booking confirmation.
          </p>
        </div>
        <VaultLoginForm />
      </div>
    </main>
  )
}
