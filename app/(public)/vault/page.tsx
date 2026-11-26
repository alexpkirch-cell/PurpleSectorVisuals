import type { Metadata } from "next"
import { Clock } from "lucide-react"

import { confirmStandardVaultPrintCheckout } from "@/app/actions/standard-vault-print"
import { lookupVaultForCurrentSession } from "@/app/actions/vault-pin"
import { BlooperReel } from "@/components/vault/blooper-reel"
import { VaultPortal } from "@/components/vault/portal/vault-portal"
import { VaultLoginForm } from "@/components/vault/vault-login-form"
import { formatShootDate } from "@/lib/operations"

export const metadata: Metadata = {
  title: "Client Vault | Purple Sector Visuals",
  description: "Access your edited photo gallery from Purple Sector Visuals.",
  robots: { index: false, follow: false },
}

function VaultShell({ children, heading }: { children: React.ReactNode; heading?: string }) {
  return (
    <main className="min-h-screen px-4 pb-16 pt-32 sm:px-8 sm:pt-36">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <div>
          <span className="font-heading text-xs font-bold tracking-[0.18em] text-muted-foreground">PURPLE SECTOR VISUALS</span>
          {heading ? <h1 className="mt-1 font-heading text-2xl font-medium text-foreground">{heading}</h1> : null}
        </div>
        {children}
      </div>
    </main>
  )
}

function VaultLogin() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-[90%] rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-md sm:w-full sm:max-w-md sm:p-8">
        <div className="mb-6 flex flex-col gap-1">
          <span className="font-heading text-xs font-bold tracking-[0.18em] text-zinc-500">PURPLE SECTOR VISUALS</span>
          <h1 className="font-heading text-xl font-medium text-zinc-50">Client Vault</h1>
          <p className="text-sm text-zinc-400">Enter your name or username and 6-digit passcode. Client bookings, team and event vaults, and individual players all sign in here.</p>
        </div>
        <VaultLoginForm />
      </div>
    </main>
  )
}

export default async function VaultLandingPage({
  searchParams,
}: {
  searchParams: Promise<{ print_session_id?: string; print_cancelled?: string }>
}) {
  const [result, query] = await Promise.all([lookupVaultForCurrentSession(), searchParams])
  if (!result.found) return <VaultLogin />

  if (result.secret) {
    return <VaultShell><BlooperReel /></VaultShell>
  }

  const { vault } = result
  if (vault.status === "Expired") {
    return (
      <VaultShell heading="Vault Expired">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center">
          <Clock className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">This vault&apos;s access window has closed. Reach out to us and we&apos;ll help you retrieve your gallery.</p>
        </div>
      </VaultShell>
    )
  }

  let printNotice: string | null = null
  if (query.print_session_id) {
    const printResult = await confirmStandardVaultPrintCheckout(vault.id, query.print_session_id)
    if (printResult === "submitted") printNotice = "Your print order has been submitted to WHCC. A shipping update will be sent to your checkout email."
    else if (printResult === "test_paid") printNotice = "Test payment confirmed. No print order was sent to WHCC."
    else if (printResult === "processing") printNotice = "Payment received. Your print order is processing and will be submitted shortly."
    else printNotice = "We couldn’t verify the print checkout. If you were charged, contact the studio."
  } else if (query.print_cancelled === "1") {
    printNotice = "Checkout was canceled. No payment was taken."
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
        printNotice={printNotice}
      />
    </VaultShell>
  )
}
