import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { getClientProfile } from "@/app/actions/crm"
import { Badge } from "@/components/ui/badge"
import { notFound } from "next/navigation"

export const metadata: Metadata = { title: "Client Profile | Purple Sector Visuals Admin", robots: { index: false, follow: false } }
export const dynamic = "force-dynamic"

export default async function ClientProfilePage({ params }: { params: Promise<{ key: string }> }) {
  const { key: encodedKey } = await params
  const profile = await getClientProfile(decodeURIComponent(encodedKey))
  if (!profile.client) notFound()
  return <div className="flex flex-col gap-6"><Link href="/admin/clients" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Client Directory</Link><div className="rounded-xl border border-border bg-card p-6"><p className="text-xs uppercase tracking-wider text-muted-foreground">Client Master Profile</p><h1 className="mt-1 font-heading text-2xl font-medium">{profile.client.name}</h1><div className="mt-4 grid gap-3 text-sm sm:grid-cols-3"><div><span className="block text-xs text-muted-foreground">Email</span>{profile.client.email}</div><div><span className="block text-xs text-muted-foreground">Phone</span>{profile.client.phone || "—"}</div><div><span className="block text-xs text-muted-foreground">Shoots</span>{profile.shoots.length}</div></div></div><section className="rounded-xl border border-border bg-card"><div className="border-b border-border p-5"><h2 className="font-heading text-lg">Shoot & Vault History</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[48rem] text-sm"><thead><tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="px-5 py-3">Shoot</th><th className="px-5 py-3">Date</th><th className="px-5 py-3">Stage</th><th className="px-5 py-3">Amount</th><th className="px-5 py-3">Vault</th></tr></thead><tbody>{profile.shoots.map((shoot) => <tr key={shoot.id} className="border-b border-border last:border-0"><th className="px-5 py-3 text-left font-medium"><Link href={`/admin/shoots/${shoot.id}`} className="text-primary hover:underline">{shoot.shootType}</Link></th><td className="px-5 py-3 text-muted-foreground">{shoot.shootDate ? new Date(shoot.shootDate).toLocaleDateString("en-US", { dateStyle: "medium" }) : "—"}</td><td className="px-5 py-3"><Badge variant="outline">{shoot.status}</Badge></td><td className="px-5 py-3">{money.format(shoot.totalPrice)}</td><td className="px-5 py-3">{shoot.vaultPin ? `PIN ${shoot.vaultPin} · ${shoot.contractSigned ? "Signed" : "Pending"}` : "No vault"}</td></tr>)}</tbody></table></div></section></div>
}

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
