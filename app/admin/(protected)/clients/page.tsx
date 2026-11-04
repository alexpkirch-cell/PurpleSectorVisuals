import type { Metadata } from "next"
import Link from "next/link"

import { listClientDirectory } from "@/app/actions/crm"
import { Badge } from "@/components/ui/badge"

export const metadata: Metadata = { title: "Client Directory | Purple Sector Visuals Admin", robots: { index: false, follow: false } }
export const dynamic = "force-dynamic"

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })

export default async function ClientDirectoryPage() {
  const clients = await listClientDirectory()
  return (
    <div className="flex flex-col gap-6">
      <div><h1 className="font-heading text-2xl font-medium text-foreground">Client Directory</h1><p className="mt-1 text-sm text-muted-foreground">The master rolodex of every client and their lifetime relationship with the studio.</p></div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[48rem] border-collapse text-sm"><caption className="sr-only">All clients</caption><thead><tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="px-4 py-3">Full Legal Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">Total Lifetime Spend</th><th className="px-4 py-3">Number of Shoots</th></tr></thead><tbody>{clients.map((client) => <tr key={client.key} className="border-b border-border last:border-0 hover:bg-accent/30"><th scope="row" className="px-4 py-3 text-left font-medium"><Link href={`/admin/clients/${encodeURIComponent(client.key)}`} className="text-primary underline-offset-4 hover:underline">{client.name}</Link></th><td className="px-4 py-3 text-muted-foreground">{client.email}</td><td className="px-4 py-3 text-muted-foreground">{client.phone || "—"}</td><td className="px-4 py-3 font-medium">{money.format(client.lifetimeSpend)}</td><td className="px-4 py-3"><Badge variant="outline">{client.shootCount}</Badge></td></tr>)}</tbody></table>
      </div>
    </div>
  )
}
