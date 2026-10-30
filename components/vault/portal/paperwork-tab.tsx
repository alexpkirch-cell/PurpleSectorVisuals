"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, FileSignature, Loader2, Wallet } from "lucide-react"

import { submitContract } from "@/app/actions/contract"
import { checkDepositStatus } from "@/app/actions/stripe"
import { activateVaultIfReady } from "@/app/actions/vault-pin"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DepositCheckout } from "@/components/vault/deposit-checkout"
import { InvoiceSummary } from "@/components/vault/invoice-summary"
import { SignaturePad } from "@/components/vault/signature-pad"
import { LIABILITY_RELEASE_TEXT, MINOR_ADDENDUM_TEXT } from "@/lib/contract-text"
import type { InvoiceData } from "@/lib/vault-documents"

interface PaperworkTabProps {
  vaultId: string
  contractSigned: boolean
  depositPaid: boolean
  contractHtml: string | null
  invoice: InvoiceData | null
  isComped: boolean
  onComplete: () => void
}

function ContractBody({ contractHtml, isMinor }: { contractHtml: string | null; isMinor: boolean }) {
  if (contractHtml) {
    return (
      <div className="max-h-72 overflow-y-auto rounded-xl border border-border bg-background p-4 text-sm leading-relaxed text-muted-foreground">
        <div
          className="[&_dd]:text-foreground [&_dl]:mb-4 [&_dl]:grid [&_dl]:gap-2 [&_dt]:text-xs [&_dt]:uppercase [&_h3]:mt-4 [&_h3]:font-medium [&_h3]:text-foreground [&_h4]:mt-4 [&_h4]:font-medium [&_h4]:text-foreground [&_p]:mt-2"
          dangerouslySetInnerHTML={{ __html: contractHtml }}
        />
        {isMinor && <p className="mt-4 whitespace-pre-line">{MINOR_ADDENDUM_TEXT}</p>}
      </div>
    )
  }

  return (
    <div className="max-h-56 overflow-y-auto rounded-xl border border-border bg-background p-4 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
      {LIABILITY_RELEASE_TEXT}
      {isMinor && `\n\n${MINOR_ADDENDUM_TEXT}`}
    </div>
  )
}

export function PaperworkTab({
  vaultId,
  contractSigned,
  depositPaid,
  contractHtml,
  invoice,
  isComped,
  onComplete,
}: PaperworkTabProps) {
  const router = useRouter()
  const [signed, setSigned] = useState(contractSigned)
  const [paid, setPaid] = useState(depositPaid || isComped)
  const [signature, setSignature] = useState("")
  const [signatureImage, setSignatureImage] = useState<string | null>(null)
  const [isMinor, setIsMinor] = useState(false)
  const [guardianName, setGuardianName] = useState("")
  const [guardianRelationship, setGuardianRelationship] = useState("")
  const [guardianSignature, setGuardianSignature] = useState("")
  const [portfolioOptOut, setPortfolioOptOut] = useState(false)
  const [signing, setSigning] = useState(false)
  const [checkingPayment, setCheckingPayment] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSign =
    signature.trim().length >= 2 &&
    signatureImage !== null &&
    (!isMinor || (guardianName.trim().length >= 2 && guardianSignature.trim().length >= 2))

  async function finish() {
    await activateVaultIfReady(vaultId)
    router.refresh()
    onComplete()
  }

  async function handleSign() {
    setError(null)
    setSigning(true)
    const result = await submitContract(vaultId, {
      signature,
      signatureImage,
      isMinor,
      guardianName,
      guardianRelationship,
      guardianSignature,
      portfolioOptOut,
    })

    if (!result.success) {
      setSigning(false)
      setError(result.error ?? "Something went wrong.")
      return
    }

    setSigned(true)
    // A $0 total has nothing to charge, so signing alone confirms the booking.
    if (isComped) {
      setPaid(true)
      await finish()
    }
    setSigning(false)
  }

  async function handleCheckPayment() {
    setCheckingPayment(true)
    const result = await checkDepositStatus(vaultId)
    if (result.depositPaid) {
      setPaid(true)
      await finish()
    }
    setCheckingPayment(false)
  }

  const fullyConfirmed = signed && paid

  return (
    <div className="flex flex-col gap-6">
      {fullyConfirmed && (
        <div className="flex items-start gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-5">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="flex flex-col gap-1">
            <h2 className="font-heading text-base font-medium text-foreground">Your booking is confirmed</h2>
            <p className="text-sm text-muted-foreground">
              {isComped
                ? "Your agreement is signed and there is nothing to pay up front."
                : "Your agreement is signed and your retainer has been received."}{" "}
              Head to Prep &amp; Planning to get ready for the shoot.
            </p>
          </div>
        </div>
      )}

      {invoice && (
        <section aria-labelledby="invoice-heading" className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
          <h2 id="invoice-heading" className="font-heading text-base font-medium text-foreground">
            Invoice
          </h2>
          <InvoiceSummary invoice={invoice} />
        </section>
      )}

      <section aria-labelledby="contract-heading" className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-primary">
          <FileSignature className="h-5 w-5" />
          <h2 id="contract-heading" className="font-heading text-base font-medium text-foreground">
            {signed ? "Signed Agreement" : "Session Agreement"}
          </h2>
        </div>

        <ContractBody contractHtml={contractHtml} isMinor={isMinor} />

        {signed ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            You have signed this agreement.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2.5">
              <Checkbox id="isMinor" checked={isMinor} onCheckedChange={(checked) => setIsMinor(checked === true)} />
              <Label htmlFor="isMinor" className="cursor-pointer text-sm">
                The subject of this session is under 18 years of age
              </Label>
            </div>

            <div className="flex items-start gap-2 rounded-md border border-border px-3 py-2.5">
              <Checkbox
                id="portfolioOptOut"
                checked={portfolioOptOut}
                onCheckedChange={(checked) => setPortfolioOptOut(checked === true)}
                className="mt-0.5"
              />
              <Label htmlFor="portfolioOptOut" className="cursor-pointer text-sm leading-snug">
                Opt out of portfolio &amp; marketing usage. Do not use my session images publicly.
              </Label>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="signature" className="text-sm text-muted-foreground">
                Type your full legal name to sign
              </Label>
              <Input
                id="signature"
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder="Jane Doe"
                className="font-serif text-lg"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-sm text-muted-foreground">Draw your signature</Label>
              <SignaturePad onChange={setSignatureImage} />
            </div>

            {isMinor && (
              <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Parent / Legal Guardian
                </p>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="guardianName" className="text-sm text-muted-foreground">
                    Guardian full name
                  </Label>
                  <Input
                    id="guardianName"
                    value={guardianName}
                    onChange={(e) => setGuardianName(e.target.value)}
                    placeholder="Alex Doe"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="guardianRelationship" className="text-sm text-muted-foreground">
                    Relationship to minor
                  </Label>
                  <Input
                    id="guardianRelationship"
                    value={guardianRelationship}
                    onChange={(e) => setGuardianRelationship(e.target.value)}
                    placeholder="Parent"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="guardianSignature" className="text-sm text-muted-foreground">
                    Type guardian&apos;s full legal name to countersign
                  </Label>
                  <Input
                    id="guardianSignature"
                    value={guardianSignature}
                    onChange={(e) => setGuardianSignature(e.target.value)}
                    placeholder="Alex Doe"
                    className="font-serif text-lg"
                  />
                </div>
              </div>
            )}

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button onClick={handleSign} disabled={!canSign || signing} className="w-full">
              {signing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isComped ? (
                "Sign & Confirm Booking"
              ) : (
                "Sign & Continue to Deposit"
              )}
            </Button>
          </>
        )}
      </section>

      {signed && !paid && (
        <section aria-labelledby="deposit-heading" className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-primary">
            <Wallet className="h-5 w-5" />
            <h2 id="deposit-heading" className="font-heading text-base font-medium text-foreground">
              Secure Your Session
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            A 50% retainer confirms your booking on the calendar. Payment is processed securely through Stripe.
          </p>
          <DepositCheckout vaultId={vaultId} />
          <Button variant="outline" onClick={handleCheckPayment} disabled={checkingPayment} className="w-full">
            {checkingPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : "I've Completed Payment"}
          </Button>
        </section>
      )}
    </div>
  )
}
