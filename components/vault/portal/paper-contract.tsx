import { Check } from "lucide-react"

import { Letterhead, PaperSheet } from "@/components/vault/portal/paper-sheet"
import { LIABILITY_RELEASE_TEXT, MINOR_ADDENDUM_TEXT } from "@/lib/contract-text"

interface PaperContractProps {
  vaultId: string
  contractHtml: string | null
  isMinor: boolean
  signed: boolean
  signerName: string | null
  signatureImage: string | null
  signedAt: string | null
  countersignature: string | null
  countersignedAt: string | null
}

function formatSignedDate(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
}

const CONTRACT_HTML_STYLES =
  "[&_dd]:text-paper-foreground [&_dl]:mb-5 [&_dl]:grid [&_dl]:gap-2 [&_dt]:font-sans [&_dt]:text-xs [&_dt]:tracking-wider [&_dt]:text-paper-muted [&_dt]:uppercase [&_h3]:mt-6 [&_h3]:mb-1 [&_h3]:font-semibold [&_h4]:mt-5 [&_h4]:mb-1 [&_h4]:font-semibold [&_p]:mt-2 [&_strong]:font-semibold [&_li]:mt-1"

export function PaperContract({
  vaultId,
  contractHtml,
  isMinor,
  signed,
  signerName,
  signatureImage,
  signedAt,
  countersignature,
  countersignedAt,
}: PaperContractProps) {
  const clientDate = formatSignedDate(signedAt)
  const studioDate = formatSignedDate(countersignedAt)

  return (
    <PaperSheet labelledBy="agreement-title" className="font-serif">
      <Letterhead
        titleId="agreement-title"
        title="Session Agreement"
        reference={`Ref. PSV-${vaultId.slice(0, 6).toUpperCase()}`}
      />

      <div className="relative">
        <div
          tabIndex={0}
          role="region"
          aria-label="Agreement terms"
          className="max-h-[32rem] overflow-y-auto pr-3 pb-10 text-[15px] leading-relaxed text-paper-foreground focus-visible:outline-2 focus-visible:outline-primary"
        >
          {contractHtml ? (
            <div className={CONTRACT_HTML_STYLES} dangerouslySetInnerHTML={{ __html: contractHtml }} />
          ) : (
            <p className="whitespace-pre-line">{LIABILITY_RELEASE_TEXT}</p>
          )}
          {isMinor && <p className="mt-6 whitespace-pre-line">{MINOR_ADDENDUM_TEXT}</p>}
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 flex h-14 items-end justify-center bg-gradient-to-t from-paper via-paper/90 to-transparent pb-1"
        >
          <span className="font-sans text-xs text-paper-muted">Scroll to read the full agreement</span>
        </div>
      </div>

      <div className="mt-10 grid gap-8 border-t border-paper-border pt-6 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <div className="flex h-12 items-end border-b border-paper-foreground/70 pb-1">
            {signed &&
              (signatureImage ? (
                // eslint-disable-next-line @next/next/no-img-element -- a base64 data URL can't use next/image
                <img src={signatureImage} alt="Client signature" className="h-11 max-w-full object-contain" />
              ) : (
                <span className="flex items-center gap-2 text-xl italic">
                  {signerName ?? "Signed electronically"}
                  <Check className="h-4 w-4 text-paper-muted" aria-hidden="true" />
                </span>
              ))}
          </div>
          <p className="font-sans text-xs text-paper-muted">
            {signed
              ? `Client signature, signed electronically${clientDate ? ` on ${clientDate}` : ""}`
              : "Client signature (awaiting signature)"}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex h-12 items-end border-b border-paper-foreground/70 pb-1">
            {countersignedAt && (
              <span className="flex items-center gap-2 text-xl italic">
                {countersignature ?? "Purple Sector Visuals"}
                <Check className="h-4 w-4 text-paper-muted" aria-hidden="true" />
              </span>
            )}
          </div>
          <p className="font-sans text-xs text-paper-muted">
            {countersignedAt
              ? `Purple Sector Visuals, countersigned${studioDate ? ` on ${studioDate}` : ""}`
              : "Purple Sector Visuals (awaiting countersignature)"}
          </p>
        </div>
      </div>
    </PaperSheet>
  )
}
