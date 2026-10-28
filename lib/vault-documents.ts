import { LIABILITY_RELEASE_TEXT } from "@/lib/contract-text"
import type { DiscountType } from "@/lib/pricing"

export interface InvoiceLineItem {
  label: string
  amount: number
}

export interface InvoiceData {
  clientName: string
  packageName: string
  items: InvoiceLineItem[]
  subtotal: number
  discountAmount: number
  discountLabel: string | null
  total: number
  deposit: number
  balance: number
  isComped: boolean
}

export interface InvoiceSource {
  clientName: string
  packageName: string
  packagePrice: number
  addons: readonly InvoiceLineItem[]
  total: number
  deposit: number
  balance: number
  isComped: boolean
  discountType: DiscountType
  discountValue: number
}

const round2 = (value: number) => Math.round(value * 100) / 100

export function buildInvoiceData(source: InvoiceSource): InvoiceData {
  const addonsTotal = round2(source.addons.reduce((sum, item) => sum + (Number(item.amount) || 0), 0))
  // Legacy shoots have no stored package price, so the package line is whatever the total leaves after add-ons.
  const packagePrice = source.packagePrice > 0 ? source.packagePrice : Math.max(0, source.total - addonsTotal)
  const subtotal = round2(packagePrice + addonsTotal)
  const discountAmount = source.isComped ? subtotal : round2(Math.max(0, subtotal - source.total))

  let discountLabel: string | null = null
  if (discountAmount > 0) {
    discountLabel =
      source.isComped
        ? "Complimentary session"
        : source.discountType === "percent" && source.discountValue > 0
          ? `Discount (${source.discountValue}%)`
          : "Discount"
  }

  return {
    clientName: source.clientName,
    packageName: source.packageName,
    items: [
      { label: source.packageName, amount: round2(packagePrice) },
      ...source.addons.map((item) => ({ label: item.label, amount: round2(Number(item.amount) || 0) })),
    ],
    subtotal,
    discountAmount,
    discountLabel,
    total: source.isComped ? 0 : round2(source.total),
    deposit: source.isComped ? 0 : round2(source.deposit),
    balance: source.isComped ? 0 : round2(source.balance),
    isComped: source.isComped,
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

const money = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)

export interface ContractSource {
  clientName: string
  shootDate: string | null
  location: string | null
  packageName: string
  invoice: InvoiceData
}

/**
 * Pre-populated Service Agreement & Media Release. Every interpolated value is
 * HTML-escaped, so the stored string is safe to render with dangerouslySetInnerHTML.
 * Generated for comped shoots too: the agreement and media release always apply.
 */
export function buildContractHtml({ clientName, shootDate, location, packageName, invoice }: ContractSource) {
  const sessionDate = shootDate
    ? new Date(shootDate).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
    : "To be confirmed"

  const paymentSchedule = invoice.isComped
    ? "This session is complimentary. No deposit or balance is due; all other terms of this agreement, including the liability release and media release, remain in full effect."
    : `Total contract price ${money(invoice.total)}. A deposit of ${money(invoice.deposit)} is due upon signing, and the remaining balance of ${money(invoice.balance)} is due on or before the day of the session.`

  const details: [string, string][] = [
    ["Client legal name", clientName],
    ["Session date", sessionDate],
    ["Location", location?.trim() || "To be confirmed"],
    ["Package", packageName],
  ]

  const detailRows = details
    .map(
      ([label, value]) =>
        `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`,
    )
    .join("")

  const clauses = LIABILITY_RELEASE_TEXT.split("\n\n")
    .map((paragraph, index) =>
      index === 0
        ? `<h3>${escapeHtml(paragraph)}</h3>`
        : `<p>${escapeHtml(paragraph)}</p>`,
    )
    .join("")

  return [
    `<h3>SERVICE AGREEMENT &amp; MEDIA RELEASE</h3>`,
    `<dl>${detailRows}</dl>`,
    `<h4>Payment schedule</h4><p>${escapeHtml(paymentSchedule)}</p>`,
    clauses,
  ].join("")
}
