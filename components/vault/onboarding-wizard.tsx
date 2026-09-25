"use client"

import { useMemo, useState } from "react"
import { Check, FileSignature, Loader2, PartyPopper, Wallet } from "lucide-react"

import { activateVaultIfReady } from "@/app/actions/vault-pin"
import { submitContract } from "@/app/actions/contract"
import { checkDepositStatus } from "@/app/actions/stripe"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DepositCheckout } from "@/components/vault/deposit-checkout"
import { LIABILITY_RELEASE_TEXT, MINOR_ADDENDUM_TEXT } from "@/lib/contract-text"
import { cn } from "@/lib/utils"

const PREP_GUIDES: Record<string, { title: string; tips: string[] }> = {
  Portraits: {
    title: "Portrait Session Prep",
    tips: [
      "Bring 2-3 outfit options — solid colors photograph best.",
      "Avoid busy logos or text on clothing.",
      "Get a good night's sleep; we'll handle the rest in retouching.",
      "Arrive 10 minutes early to settle in before we start shooting.",
    ],
  },
  Automotive: {
    title: "Automotive Shoot Prep",
    tips: [
      "Wash and detail the vehicle 24-48 hours before the shoot.",
      "Remove parking permits, toll tags, and dealership plates if possible.",
      "Fill the tank — full tanks look better in fuel gauge shots.",
      "Scout for low-traffic golden-hour windows; we'll confirm timing.",
    ],
  },
  Athletics: {
    title: "Athletics Coverage Prep",
    tips: [
      "Send us the game/event schedule and roster in advance.",
      "Confirm sideline or media credential access if required.",
      "Have your athlete's jersey number ready for spotlight requests.",
      "We'll arrive 30 minutes before puck drop / kickoff / tip-off.",
    ],
  },
  Events: {
    title: "Event Coverage Prep",
    tips: [
      "Share a run-of-show or timeline so we don't miss key moments.",
      "Point out any VIPs or must-have shots in advance.",
      "Confirm venue photography restrictions ahead of time.",
      "We'll do a walkthrough of the space 15 minutes before start.",
    ],
  },
}

type Step = "contract" | "deposit" | "prep" | "unlock"

export function OnboardingWizard({
  vaultId,
  category,
  contractSigned,
  depositPaid,
}: {
  vaultId: string
  category: string | null
  contractSigned: boolean
  depositPaid: boolean
}) {
  const steps: Step[] = ["contract", "deposit", "prep", "unlock"]
  const initialStep = !contractSigned ? "contract" : !depositPaid ? "deposit" : "prep"
  const [step, setStep] = useState<Step>(initialStep)
  const [signature, setSignature] = useState("")
  const [isMinor, setIsMinor] = useState(false)
  const [guardianName, setGuardianName] = useState("")
  const [guardianRelationship, setGuardianRelationship] = useState("")
  const [guardianSignature, setGuardianSignature] = useState("")
  const [portfolioOptOut, setPortfolioOptOut] = useState(false)
  const [signing, setSigning] = useState(false)
  const [signed, setSigned] = useState(contractSigned)
  const [paid, setPaid] = useState(depositPaid)
  const [checkingPayment, setCheckingPayment] = useState(false)
  const [activating, setActivating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const guide = useMemo(() => PREP_GUIDES[category ?? ""] ?? PREP_GUIDES.Portraits, [category])
  const currentIndex = steps.indexOf(step)

  const canSign =
    signature.trim().length >= 2 && (!isMinor || (guardianName.trim().length >= 2 && guardianSignature.trim().length >= 2))

  async function handleSign() {
    setError(null)
    setSigning(true)
    const result = await submitContract(vaultId, {
      signature,
      isMinor,
      guardianName,
      guardianRelationship,
      guardianSignature,
      portfolioOptOut,
    })
    setSigning(false)
    if (!result.success) {
      setError(result.error ?? "Something went wrong.")
      return
    }
    setSigned(true)
    setStep("deposit")
  }

  async function handleCheckPayment() {
    setCheckingPayment(true)
    const result = await checkDepositStatus(vaultId)
    setCheckingPayment(false)
    if (result.depositPaid) {
      setPaid(true)
      setStep("prep")
    }
  }

  async function handleUnlock() {
    setActivating(true)
    await activateVaultIfReady(vaultId)
    setActivating(false)
    window.location.reload()
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <ol className="flex items-center justify-between gap-2">
        {steps.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                i < currentIndex
                  ? "border-primary bg-primary text-primary-foreground"
                  : i === currentIndex
                    ? "border-primary text-primary"
                    : "border-border text-muted-foreground"
              )}
            >
              {i < currentIndex ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            {i < steps.length - 1 && (
              <div className={cn("h-px flex-1", i < currentIndex ? "bg-primary" : "bg-border")} />
            )}
          </li>
        ))}
      </ol>

      {step === "contract" && (
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-primary">
            <FileSignature className="h-5 w-5" />
            <h2 className="font-serif text-lg text-foreground">Sign Your Session Agreement</h2>
          </div>
          <div className="max-h-56 overflow-y-auto rounded-xl border border-border bg-background p-4 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
            {LIABILITY_RELEASE_TEXT}
            {isMinor && (
              <>
                {"\n\n"}
                {MINOR_ADDENDUM_TEXT}
              </>
            )}
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
              Opt out of portfolio &amp; marketing usage — do not use my session images publicly
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
                  Type guardian's full legal name to countersign
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

          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={handleSign} disabled={!canSign || signing} className="w-full">
            {signing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign & Continue"}
          </Button>
        </div>
      )}

      {step === "deposit" && (
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-primary">
            <Wallet className="h-5 w-5" />
            <h2 className="font-serif text-lg text-foreground">Secure Your Session</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            A 20% retainer confirms your booking on the calendar. This is processed securely through Stripe.
          </p>
          {!paid ? (
            <>
              <DepositCheckout vaultId={vaultId} />
              <Button variant="outline" onClick={handleCheckPayment} disabled={checkingPayment} className="w-full">
                {checkingPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : "I've Completed Payment"}
              </Button>
            </>
          ) : (
            <Button onClick={() => setStep("prep")} className="w-full">
              Continue
            </Button>
          )}
        </div>
      )}

      {step === "prep" && (
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
          <h2 className="font-serif text-lg text-foreground">{guide.title}</h2>
          <ul className="flex flex-col gap-3 text-sm text-muted-foreground">
            {guide.tips.map((tip) => (
              <li key={tip} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
          <Button onClick={() => setStep("unlock")} className="w-full">
            Continue
          </Button>
        </div>
      )}

      {step === "unlock" && (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-6 text-center">
          <PartyPopper className="h-8 w-8 text-primary" />
          <h2 className="font-serif text-lg text-foreground">Welcome to The Vault</h2>
          <p className="text-sm text-muted-foreground">
            Your entire project lives in one secure digital hub. Use The Vault to review and sign your production
            agreement, lock in your calendar date with a 20% retainer, and preview your finished collection. Once
            your final 80% balance is completed, your high-resolution digital archive unlocks instantly—complete
            with a built-in custom print studio delivering archival wall art and prints straight to your door.
          </p>
          <Button onClick={handleUnlock} disabled={activating} className="w-full">
            {activating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Unlock My Vault"}
          </Button>
        </div>
      )}
    </div>
  )
}
