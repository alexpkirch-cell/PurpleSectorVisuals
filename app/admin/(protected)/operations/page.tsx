import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowUpRight,
  Camera,
  ClipboardList,
  FileSignature,
  Kanban,
  PencilRuler,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react"

export const metadata: Metadata = {
  title: "Operations | Purple Sector Visuals",
  robots: { index: false, follow: false },
}

const tools: { href: string; label: string; description: string; icon: LucideIcon }[] = [
  {
    href: "/admin/operations/pipeline",
    label: "Shoot Pipeline & Requests",
    description: "Approve booking requests, run the shoot pipeline, and clear the print fulfillment queue.",
    icon: ClipboardList,
  },
  {
    href: "/admin/command-center",
    label: "Command Center",
    description: "Projects, contractors, and finances in one board.",
    icon: Kanban,
  },
  {
    href: "/admin/financials",
    label: "Financials & Ledger",
    description: "Payouts, splits, and settlement for every shoot.",
    icon: Wallet,
  },
  {
    href: "/admin/legal",
    label: "Legal Hub",
    description: "Contracts, releases, and signed documents.",
    icon: FileSignature,
  },
  {
    href: "/admin/gear",
    label: "Gear Locker",
    description: "Track equipment and who has it.",
    icon: Camera,
  },
  {
    href: "/admin/roster",
    label: "Roster & Teams",
    description: "Public team profiles and shooter assignments.",
    icon: Users,
  },
  {
    href: "/admin/site-editor",
    label: "Site Editor",
    description: "Edit public pages and layouts.",
    icon: PencilRuler,
  },
]

export default function AdminOperationsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-medium text-foreground">Operations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Back-office tools for running the studio day to day.
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tools.map((tool) => {
          const Icon = tool.icon
          return (
            <li key={tool.href}>
              <Link
                href={tool.href}
                className="group flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent"
              >
                <div className="flex items-center justify-between">
                  <Icon className="size-5 text-primary" />
                  <ArrowUpRight className="size-4 text-muted-foreground transition-colors group-hover:text-foreground" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-heading text-sm font-medium text-foreground">{tool.label}</span>
                  <span className="text-sm text-muted-foreground">{tool.description}</span>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
