"use client"

import { useState } from "react"
import { FileSignature, Lock, PenLine, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import useSWR from "swr"

import { getVaultLegalRecord } from "@/app/actions/vault-legal"
import { countersignShoot, type Shoot } from "@/app/actions/shoots"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

function formatTimestamp(iso: string | null) {
  if (!iso) return "Not recorded"
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  })
}

function Fact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[0.65rem] tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className={mono ? "font-mono text-xs break-all text-foreground" : "text-sm break-words text-foreground"}>{value}</dd>
    </div>
  )
}

/** The executed service agreement: drawn signature, ESIGN audit trail, and the studio's countersignature. */
export function WorkspaceAgreementCard({ shoot, onUpdated }: { shoot: Shoot; onUpdated: (shoot: Shoot) => void }) {
  const [isCountersigning, setIsCountersigning] = useState(false)
  const vaultId = shoot.vault_id

  const { data: legal, isLoading, mutate } = useSWR(vaultId ? ["vault-legal", vaultId] : null, () => getVaultLegalRecord(vaultId!), {
    revalidateOnFocus: false,
  })

  async function handleCountersign() {
    setIsCountersigning(true)
    try {
      const updated = await countersignShoot(shoot.id)
      onUpdated(updated)
      await mutate()
      toast.success(
        updated.status === "booked_paid"
          ? `Countersigned. ${shoot.client_name} is now Booked & Paid.`
          : "Countersigned and locked. The card moves to Booked & Paid once the retainer is received."
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not countersign")
    } finally {
      setIsCountersigning(false)
    }
  }

  const signed = Boolean(legal?.contractSigned)
  const countersigned = Boolean(legal?.countersignedAt)

  return (
    <section aria-labelledby="workspace-agreement" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 id="workspace-agreement" className="flex items-center gap-2 font-heading text-base font-medium text-foreground">
          <FileSignature className="size-4 text-primary" aria-hidden="true" />
          Service Agreement
        </h2>
        {legal ? (
          <Badge
            variant="outline"
            className={
              countersigned
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : signed
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "border-border text-muted-foreground"
            }
          >
            {countersigned ? "Fully executed" : signed ? "Awaiting countersignature" : "Not signed"}
          </Badge>
        ) : null}
      </div>

      {!vaultId ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          No vault yet. The agreement is created when the shoot moves to Awaiting Signature &amp; Retainer.
        </p>
      ) : isLoading || !legal ? (
        <div className="h-40 animate-pulse rounded-lg bg-muted" role="status" aria-label="Loading agreement" />
      ) : !signed ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          Waiting for the client to sign their service agreement.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Client signature</h3>
            <div className="flex min-h-28 items-center justify-center rounded-lg border border-border bg-white p-3">
              {legal.clientSignatureImage ? (
                // eslint-disable-next-line @next/next/no-img-element -- the client's drawn signature stored as a data URL
                <img
                  src={legal.clientSignatureImage}
                  alt={`Drawn signature of ${legal.typedLegalName ?? shoot.client_name}`}
                  className="block h-auto max-h-36 w-auto max-w-full"
                />
              ) : (
                <span className="text-sm text-neutral-500">No drawn signature on file</span>
              )}
            </div>
          </div>

          <dl className="grid gap-3 sm:grid-cols-2">
            <Fact label="Typed legal name" value={legal.typedLegalName ?? shoot.client_name} />
            <Fact label="Captured IP address" value={legal.clientSignedIp ?? "Not recorded"} mono />
            <Fact label="ESIGN timestamp" value={formatTimestamp(legal.clientSignedAt)} />
            <Fact label="Timestamp (ISO 8601)" value={legal.clientSignedAt ?? "Not recorded"} mono />
            {legal.clientSignedUserAgent ? <Fact label="Device" value={legal.clientSignedUserAgent} /> : null}
          </dl>

          {countersigned ? (
            <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
              <Lock className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <div className="flex flex-col gap-1 text-sm">
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  Countersigned &amp; locked
                </span>
                <span className="text-muted-foreground">
                  {legal.countersignature ? `${legal.countersignature} \u00b7 ` : ""}
                  {formatTimestamp(legal.countersignedAt)}
                </span>
                {legal.countersignedIp ? (
                  <span className="font-mono text-xs text-muted-foreground">IP {legal.countersignedIp}</span>
                ) : null}
                <span className="text-xs text-muted-foreground">The document can no longer be edited.</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 rounded-lg border border-primary/40 bg-primary/10 p-4">
              <p className="text-sm text-foreground">
                The client has signed. Countersign to lock the agreement permanently and book the shoot.
              </p>
              <Button type="button" size="lg" onClick={handleCountersign} disabled={isCountersigning} className="w-full">
                <PenLine className="size-4" aria-hidden="true" />
                {isCountersigning ? "Countersigning..." : "Countersign Agreement"}
              </Button>
            </div>
          )}

          {legal.contractHtml ? (
            <details className="rounded-lg border border-border">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                View the full agreement text
              </summary>
              <iframe
                title="Executed service agreement"
                sandbox=""
                srcDoc={legal.contractHtml}
                className="h-96 w-full rounded-b-lg border-t border-border bg-white"
              />
            </details>
          ) : null}
        </>
      )}
    </section>
  )
}
