import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Clock } from "lucide-react"

import { lookupVaultByPin } from "@/app/actions/vault-pin"
import { BlooperReel } from "@/components/vault/blooper-reel"
import { VaultPortal } from "@/components/vault/portal/vault-portal"
import { VaultGate } from "@/components/vault/vault-gate"
import { formatShootDate } from "@/lib/operations"
import { hasVaultSession, isAdminViewer } from "@/lib/vault-session"

export const metadata: Metadata = {
  title: "Client Vault | Purple Sector Visuals",
  robots: { index: false, follow: false },
}

function VaultShell({ children, heading }: { children: React.ReactNode; heading?: string }) {
  return (
    <main className="min-h-screen px-4 pb-16 pt-32 sm:px-8 sm:pt-36">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <div>
          <span className="font-heading text-xs font-bold tracking-[0.18em] text-muted-foreground">
            PURPLE SECTOR VISUALS
          </span>
          {heading && <h1 className="mt-1 font-heading text-2xl font-medium text-foreground">{heading}</h1>}
        </div>
        {children}
      </div>
    </main>
  )
}

function isPin(token: string) {
  return /^\d{4,6}$/.test(token)
}

export default async function VaultTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  if (!isPin(token)) {
    redirect("/vault")
  }

  const result = await lookupVaultByPin(token)

  // Unknown codes and signed-out visitors see the exact same sign-in, so codes can't be probed via the URL.
  if (!result.found) {
    return <VaultGate code={token} />
  }

  if (result.secret) {
    return (
      <VaultShell>
        <BlooperReel />
      </VaultShell>
    )
  }

  const { vault } = result

  // The code alone is never enough: the client must have signed in with their email + access code.
  const hasAccess = (await hasVaultSession(vault.id)) || (await isAdminViewer())
  if (!hasAccess) {
    return <VaultGate code={token} />
  }

  if (vault.status === "Expired") {
    return (
      <VaultShell heading="Vault Expired">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center">
          <Clock className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            This vault&apos;s access window has closed. Reach out to us and we&apos;ll help you retrieve your
            gallery.
          </p>
        </div>
      </VaultShell>
    )
  }

  return (
    <VaultShell heading={`Welcome, ${vault.clientName}`}>
      <VaultPortal
        vaultId={vault.id}
        category={vault.category}
        location={vault.location}
        shootDateLabel={formatShootDate(vault.shootDate, true)}
        contractHtml={vault.contractHtml}
        invoice={vault.invoiceData}
        isComped={vault.isComped}
        mustHaveShots={vault.mustHaveShots}
        moodBoardLinks={vault.moodBoardLinks}
        prepSubmitted={vault.prepSubmittedAt !== null}
        clientSignatureImage={vault.clientSignatureImage}
        clientSignedAt={vault.clientSignedAt}
        signedName={vault.signedName}
        signedIp={vault.clientSignedIp}
        signatureHash={vault.signatureHash}
        initialProgress={{
          shootStatus: vault.shootStatus,
          photoCount: vault.photoCount,
          contractSigned: vault.contractSigned,
          depositPaid: vault.depositPaid,
          countersignature: vault.countersignature,
          countersignedAt: vault.countersignedAt,
        }}
      />
    </VaultShell>
  )
}
