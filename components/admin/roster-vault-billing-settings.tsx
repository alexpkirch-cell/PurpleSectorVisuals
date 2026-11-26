"use client"

import { useState, useTransition } from "react"
import { CircleCheck, Wallet } from "lucide-react"
import { toast } from "sonner"

import {
  markRosterTeamBalancePaid,
  markRosterTeamBalanceUnpaid,
  updateRosterVaultTeam,
  type RosterVaultTeam,
} from "@/app/actions/roster-vault"
import { BALANCE_METHOD_LABELS, BalancePaymentDialog } from "@/components/admin/balance-payment-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type BillingMode = RosterVaultTeam["vault_billing_mode"]

const MODE_OPTIONS: { value: BillingMode; title: string; description: string }[] = [
  {
    value: "parent_pay",
    title: "Low-Retainer / Parent Pay-Per-Order",
    description:
      "Parents see watermarked proofs. High-resolution files are locked behind their own Stripe checkout: one photo, a player's full digital bundle, or WHCC prints.",
  },
  {
    value: "all_inclusive",
    title: "All-Inclusive Team Buyout",
    description:
      "The team pays up front. Once the team's 50% balance is marked paid, anyone signed in with the master Team / Event Name and passcode can download every player folder and the team folder. WHCC prints stay optional.",
  },
]

function formatPaidDate(value: string | Date) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export function RosterVaultBillingSettings({
  team,
  onTeamChange,
}: {
  team: RosterVaultTeam
  onTeamChange: (team: RosterVaultTeam) => void
}) {
  const [mode, setMode] = useState<BillingMode>(team.vault_billing_mode)
  const [priceUsd, setPriceUsd] = useState(team.single_photo_price_cents ? (team.single_photo_price_cents / 100).toFixed(2) : "")
  const [pending, startTransition] = useTransition()
  const [balanceDialogOpen, setBalanceDialogOpen] = useState(false)

  const dirty =
    mode !== team.vault_billing_mode ||
    (priceUsd.trim() === "" ? null : Math.round(Number(priceUsd) * 100)) !== team.single_photo_price_cents

  function saveBilling() {
    const singlePhotoPriceCents = priceUsd.trim() === "" ? null : Math.round(Number(priceUsd) * 100)
    startTransition(async () => {
      try {
        await updateRosterVaultTeam({
          id: team.id,
          name: team.name,
          isActive: team.is_active,
          vaultBillingMode: mode,
          singlePhotoPriceCents,
        })
        onTeamChange({ ...team, vault_billing_mode: mode, single_photo_price_cents: singlePhotoPriceCents })
        toast.success("Billing mode saved. It applies to parents immediately.")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not save billing settings")
      }
    })
  }

  async function recordBalance(input: { method: "cash" | "check" | "external_transfer"; note: string }) {
    try {
      const state = await markRosterTeamBalancePaid({ teamId: team.id, ...input })
      onTeamChange({ ...team, ...state })
      toast.success("Team balance marked paid. Downloads are unlocked for the whole team.")
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not record the payment")
      return false
    }
  }

  function reopenLock() {
    startTransition(async () => {
      try {
        const state = await markRosterTeamBalanceUnpaid(team.id)
        onTeamChange({ ...team, ...state })
        toast.success("Team balance marked unpaid. Downloads are locked again.")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not update the balance")
      }
    })
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5" aria-labelledby="roster-billing-heading">
      <div>
        <h2 id="roster-billing-heading" className="font-heading text-base font-semibold text-foreground">Delivery &amp; billing mode</h2>
        <p className="mt-1 text-xs text-muted-foreground">Choose how this team receives its high-resolution photos. Switching takes effect for parents right away.</p>
      </div>

      <div role="radiogroup" aria-label="Vault billing mode" className="grid gap-3 lg:grid-cols-2">
        {MODE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={mode === option.value}
            onClick={() => setMode(option.value)}
            disabled={pending}
            className={cn(
              "flex flex-col gap-1.5 rounded-lg border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              mode === option.value ? "border-primary bg-primary/10" : "border-border hover:border-primary/40",
            )}
          >
            <span className="text-sm font-semibold text-foreground">{option.title}</span>
            <span className="text-xs leading-relaxed text-muted-foreground">{option.description}</span>
          </button>
        ))}
      </div>

      {mode === "parent_pay" ? (
        <div className="flex max-w-xs flex-col gap-1.5">
          <Label htmlFor="roster-single-photo-price">Single-photo download price (USD)</Label>
          <Input
            id="roster-single-photo-price"
            type="number"
            min="1"
            max="10000"
            step="0.01"
            inputMode="decimal"
            value={priceUsd}
            onChange={(event) => setPriceUsd(event.target.value)}
            placeholder="Leave blank to turn off"
            disabled={pending}
          />
          <p className="text-xs text-muted-foreground">Full-bundle prices come from the gallery tiers below. Parents pay these prices at checkout.</p>
        </div>
      ) : null}

      <div>
        <Button type="button" size="sm" onClick={saveBilling} disabled={pending || !dirty}>
          {pending ? "Saving…" : "Save billing mode"}
        </Button>
      </div>

      {team.vault_billing_mode === "all_inclusive" ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-background/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Wallet className="size-4 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm font-medium text-foreground">Team balance (50%)</p>
              {team.balance_paid ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                  <CircleCheck className="size-3" aria-hidden="true" /> Paid
                </span>
              ) : (
                <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-muted-foreground">Pending</span>
              )}
            </div>
            {team.balance_paid ? (
              <Button type="button" size="sm" variant="ghost" onClick={reopenLock} disabled={pending}>
                Mark unpaid
              </Button>
            ) : (
              <Button type="button" size="sm" variant="outline" onClick={() => setBalanceDialogOpen(true)}>
                Mark Balance Paid
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {team.balance_paid
              ? `Paid by ${BALANCE_METHOD_LABELS[team.balance_payment_method ?? ""] ?? "unknown method"}${team.balance_paid_at ? ` on ${formatPaidDate(team.balance_paid_at)}` : ""}. Every player folder and the team folder download free for anyone signed in with the master Team / Event Name and passcode.`
              : "Until this is marked paid, parents only see watermarked proofs. Marking it paid unlocks free downloads for the whole team."}
          </p>
          <BalancePaymentDialog
            open={balanceDialogOpen}
            onOpenChange={setBalanceDialogOpen}
            title="Mark team balance paid"
            description={`Record the second 50% for ${team.name} as received. Free high-resolution downloads unlock immediately across all player folders and the team folder.`}
            onConfirm={recordBalance}
          />
        </div>
      ) : null}
    </section>
  )
}
