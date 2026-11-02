import { Letterhead, PaperSheet } from "@/components/vault/portal/paper-sheet"
import type { InvoiceData } from "@/lib/vault-documents"

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })

interface PaperInvoiceProps {
  vaultId: string
  invoice: InvoiceData
  depositPaid: boolean
}

export function PaperInvoice({ vaultId, invoice, depositPaid }: PaperInvoiceProps) {
  const retainerStatus = invoice.isComped ? "Waived" : depositPaid ? "Paid" : "Due at booking"
  const balanceStatus = invoice.isComped ? "Waived" : "Due on delivery"

  return (
    <PaperSheet labelledBy="invoice-title" className="font-sans">
      <Letterhead titleId="invoice-title" title="Invoice" reference={`No. PSV-${vaultId.slice(0, 6).toUpperCase()}`} />

      <dl className="mb-8 grid gap-4 text-sm sm:grid-cols-2">
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs font-medium tracking-wider text-paper-muted uppercase">Billed to</dt>
          <dd className="font-medium">{invoice.clientName}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs font-medium tracking-wider text-paper-muted uppercase">Package</dt>
          <dd className="font-medium">{invoice.packageName}</dd>
        </div>
      </dl>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-paper-foreground/70 text-left text-xs tracking-wider text-paper-muted uppercase">
            <th scope="col" className="pb-2 font-medium">
              Description
            </th>
            <th scope="col" className="pb-2 text-right font-medium">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item) => (
            <tr key={item.label} className="border-b border-paper-border">
              <td className="py-2.5 pr-4">{item.label}</td>
              <td className="py-2.5 text-right tabular-nums">{money.format(item.amount)}</td>
            </tr>
          ))}
          {invoice.discountAmount > 0 && (
            <tr className="border-b border-paper-border">
              <td className="py-2.5 pr-4">{invoice.discountLabel ?? "Discount"}</td>
              <td className="py-2.5 text-right tabular-nums">-{money.format(invoice.discountAmount)}</td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className="pt-4 pr-4 text-right text-xs font-medium tracking-wider text-paper-muted uppercase">
              Total
            </th>
            <td className="pt-4 text-right font-heading text-xl font-medium tabular-nums">{money.format(invoice.total)}</td>
          </tr>
        </tfoot>
      </table>

      <section aria-label="Payment schedule" className="mt-8 flex flex-col gap-2 border-t border-paper-border pt-5 text-sm">
        <h3 className="text-xs font-medium tracking-wider text-paper-muted uppercase">Payment schedule</h3>
        <div className="flex items-baseline justify-between gap-4">
          <span>Retainer (50%)</span>
          <span className="flex items-baseline gap-3">
            <span className="text-xs text-paper-muted">{retainerStatus}</span>
            <span className="tabular-nums">{invoice.isComped ? "$0.00" : money.format(invoice.deposit)}</span>
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <span>Balance (50%)</span>
          <span className="flex items-baseline gap-3">
            <span className="text-xs text-paper-muted">{balanceStatus}</span>
            <span className="tabular-nums">{invoice.isComped ? "$0.00" : money.format(invoice.balance)}</span>
          </span>
        </div>
      </section>

      <footer className="mt-8 text-xs text-paper-muted">Thank you for choosing Purple Sector Visuals.</footer>
    </PaperSheet>
  )
}
