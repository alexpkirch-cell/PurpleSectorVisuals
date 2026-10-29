import type { InvoiceData } from "@/lib/vault-documents"

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })

export function InvoiceSummary({ invoice }: { invoice: InvoiceData }) {
  return (
    <section aria-label="Itemized invoice" className="rounded-xl border border-border bg-background p-4 text-sm">
      <h3 className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">Itemized Invoice</h3>
      <dl className="flex flex-col gap-2">
        {invoice.items.map((item) => (
          <div key={item.label} className="flex items-baseline justify-between gap-4">
            <dt className="text-foreground">{item.label}</dt>
            <dd className="text-muted-foreground tabular-nums">{money.format(item.amount)}</dd>
          </div>
        ))}
        {invoice.discountAmount > 0 && (
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-foreground">{invoice.discountLabel ?? "Discount"}</dt>
            <dd className="text-muted-foreground tabular-nums">-{money.format(invoice.discountAmount)}</dd>
          </div>
        )}
        <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-border pt-2 font-medium">
          <dt className="text-foreground">Total</dt>
          <dd className="text-foreground tabular-nums">{money.format(invoice.total)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-muted-foreground">Deposit due</dt>
          <dd className="text-muted-foreground tabular-nums">
            {invoice.isComped ? "$0.00 (Waived)" : money.format(invoice.deposit)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-muted-foreground">Balance due</dt>
          <dd className="text-muted-foreground tabular-nums">
            {invoice.isComped ? "$0.00 (Waived)" : money.format(invoice.balance)}
          </dd>
        </div>
      </dl>
    </section>
  )
}
