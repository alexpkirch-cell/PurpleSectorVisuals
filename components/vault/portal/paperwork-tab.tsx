"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, FileSignature, Loader2, Lock, Wallet } from "lucide-react"

import { submitContract } from "@/app/actions/contract"
import { checkDepositStatus } from "@/app/actions/stripe"
import { activateVaultIfReady } from "@/app/actions/vault-pin"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DepositCheckout } from "@/components/vault/deposit-checkout"
import { PaperContract, type SignatureRecord } from "@/components/vault/portal/paper-contract"
import { PaperInvoice } from "@/components/vault/portal/paper-invoice"
import { SignaturePad } from "@/components/vault/signature-pad"
import type { InvoiceData } from "@/lib/vault-documents"

interface PaperworkTabProps {
  vaultId: string
  contractSigned: boolean
  depositPaid: boolean
  contractHtml: string | null
  invoice: InvoiceData | null
  isComped: boolean
  clientSignatureImage: string | null
  clientSignedAt: string | null
  signedName: string | null
  signedIp: string | null
  signatureHash: string | null
  countersignature: string | null
  countersignedAt: string | null
  onComplete: () => void
}

export function PaperworkTab({
  vaultId,
  contractSigned,
  depositPaid,
  contractHtml,
  invoice,
  isComped,
  clientSignatureImage,
  clientSignedAt,
  signedName: savedSignedName,
  signedIp,
  signatureHash,
  countersignature,
  countersignedAt,
  onComplete,
}: PaperworkTabProps) {
  const router = useRouter()
  const [signed, setSigned] = useState(contractSigned)
  // Signing unlocks only after the reader has scrolled through the whole agreement.
  const [hasReadAgreement, setHasReadAgreement] = useState(contractSigned)
  const handleReachedEnd = useCallback(() => setHasReadAgreement(true), [])
  const [freshRecord, setFreshRecord] = useState<SignatureRecord | null>(null)
  const [paid, setPaid] = useState(depositPaid || isComped)
  const [signature, setSignature] = useState("")
  const [signedName, setSignedName] = useState<string | null>(null)
  const [signedAtNow, setSignedAtNow] = useState<string | null>(null)
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
    hasReadAgreement &&
    signature.trim().length >= 2 &&
    signatureImage !== null &&
    (!isMinor || (guardianName.trim().length >= 2 && guardianSignature.trim().length >= 2))

  // Right after signing it comes from the server's response; on later visits from the saved record.
  const record: SignatureRecord | null =
    freshRecord ??
    (contractSigned && clientSignedAt && signatureHash
      ? { name: savedSignedName ?? "Signed electronically", signedAt: clientSignedAt, ip: signedIp, hash: signatureHash }
      : null)

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
      agreementReviewed: hasReadAgreement,
    })

    if (!result.success) {
      setSigning(false)
      setError(result.error ?? "Something went wrong.")
      return
    }

    setSigned(true)
    setSignedName(result.footprint.signedName)
    setSignedAtNow(result.footprint.signedAt)
    setFreshRecord({
      name: result.footprint.signedName,
      signedAt: result.footprint.signedAt,
      ip: result.footprint.ipAddress,
      hash: result.footprint.signatureHash,
    })
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
    <div className="flex flex-col gap-8">
      {fullyConfirmed && (
        <div className="flex items-start gap-3 rounded-xl border border-primary/40 bg-primary/10 p-5">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="flex flex-col gap-1">
            <h2 className="font-heading text-base font-medium text-foreground">
              {countersignedAt ? "Your booking is confirmed" : "Signed. Awaiting countersignature"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isComped
                ? "Your agreement is signed and there is nothing to pay up front."
                : "Your agreement is signed and your retainer has been received."}{" "}
              {countersignedAt
                ? "Head to Prep & Planning to get ready for the shoot."
                : "Purple Sector Visuals will countersign shortly to finalize your booking. You can start on Prep & Planning in the meantime."}
            </p>
          </div>
        </div>
      )}

      {invoice && <PaperInvoice vaultId={vaultId} invoice={invoice} depositPaid={paid && !isComped} />}

      <PaperContract
        vaultId={vaultId}
        contractHtml={contractHtml}
        isMinor={isMinor}
        signed={signed}
        signerName={signedName}
        signatureImage={clientSignatureImage ?? (signed ? signatureImage : null)}
        signedAt={clientSignedAt ?? signedAtNow}
        countersignature={countersignature}
        countersignedAt={countersignedAt}
        record={record}
        onReachedEnd={handleReachedEnd}
      />

      {!signed && (
        <section aria-labelledby="sign-heading" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-primary">
            <FileSignature className="h-5 w-5" />
            <h2 id="sign-heading" className="font-heading text-base font-medium text-foreground">
              Sign this agreement
            </h2>
          </div>

          <div
            role="status"
            aria-live="polite"
            className={`flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm ${
              hasReadAgreement
                ? "border-primary/40 bg-primary/10 text-foreground"
                : "border-dashed border-border text-muted-foreground"
            }`}
          >
            {hasReadAgreement ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            ) : (
              <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span>
              {hasReadAgreement
                ? "You have reached the end of the agreement. Signing is unlocked."
                : "Scroll to the end of the agreement above to unlock signing. You can also click into it and press End."}
            </span>
          </div>

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
              disabled={!hasReadAgreement}
              className="font-serif text-lg"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-sm text-muted-foreground">Draw your signature</Label>
            <SignaturePad onChange={setSignatureImage} disabled={!hasReadAgreement} />
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
                  disabled={!hasReadAgreement}
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
                  disabled={!hasReadAgreement}
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
                  disabled={!hasReadAgreement}
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
        </section>
      )}

      {signed && !paid && (
        <section aria-labelledby="deposit-heading" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
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
