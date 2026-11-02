import { Check } from "lucide-react"

import { Letterhead, PaperSheet } from "@/components/vault/portal/paper-sheet"
import { LIABILITY_RELEASE_TEXT, MINOR_ADDENDUM_TEXT } from "@/lib/contract-text"

interface PaperContractProps {
  vaultId: string
  contractHtml: string | null
  isMinor: boolean
  signed: boolean
  signerName: string | null
}

const CONTRACT_HTML_STYLES =
  "[&_dd]:text-paper-foreground [&_dl]:mb-5 [&_dl]:grid [&_dl]:gap-2 [&_dt]:font-sans [&_dt]:text-xs [&_dt]:tracking-wider [&_dt]:text-paper-muted [&_dt]:uppercase [&_h3]:mt-6 [&_h3]:mb-1 [&_h3]:font-semibold [&_h4]:mt-5 [&_h4]:mb-1 [&_h4]:font-semibold [&_p]:mt-2 [&_strong]:font-semibold [&_li]:mt-1"

export function PaperContract({ vaultId, contractHtml, isMinor, signed, signerName }: PaperContractProps) {
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
          <div className="flex h-11 items-end border-b border-paper-foreground/70 pb-1">
            {signed && (
              <span className="flex items-center gap-2 text-xl italic">
                {signerName ?? "Signed electronically"}
                <Check className="h-4 w-4 text-paper-muted" aria-hidden="true" />
              </span>
            )}
          </div>
          <p className="font-sans text-xs text-paper-muted">
            {signed ? "Client signature (signed electronically)" : "Client signature (awaiting signature)"}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex h-11 items-end border-b border-paper-foreground/70 pb-1">
            <span className="text-xl italic">Purple Sector Visuals</span>
          </div>
          <p className="font-sans text-xs text-paper-muted">Photographer</p>
        </div>
      </div>
    </PaperSheet>
  )
}
