"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Briefcase,
  CalendarCheck,
  Camera,
  ChevronDown,
  FileSignature,
  GalleryVerticalEnd,
  Images,
  Kanban,
  LayoutGrid,
  LogOut,
  Package,
  PencilRuler,
  ScanFace,
  UserRoundCheck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type NavLink = { href: string; label: string; icon: LucideIcon }

const primaryLinks: NavLink[] = [
  { href: "/admin", label: "Overview", icon: LayoutGrid },
  { href: "/admin/command-center", label: "Command Center", icon: Kanban },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarCheck },
  { href: "/admin/galleries", label: "Vaults", icon: Images },
  { href: "/admin/portfolio", label: "Portfolio CMS", icon: GalleryVerticalEnd },
  { href: "/admin/site-editor", label: "Site Editor", icon: PencilRuler },
  { href: "/admin/roster", label: "Roster & Teams", icon: Users },
  { href: "/admin/crew", label: "1099 Crew Hub", icon: UserRoundCheck },
  { href: "/admin/packages", label: "Package Manager", icon: Package },
]

const operationsLinks: NavLink[] = [
  { href: "/admin/financials", label: "Financials & Ledger", icon: Wallet },
  { href: "/admin/legal", label: "Legal Hub", icon: FileSignature },
]

const eventLink: NavLink = { href: "/admin/event-upload", label: "Event Uploads", icon: ScanFace }

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin"
  return pathname === href || pathname.startsWith(`${href}/`)
}

const itemClass =
  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"

export function AdminSidebar({ displayName }: { displayName: string }) {
  const pathname = usePathname()
  const router = useRouter()

  const operationsActive = operationsLinks.some((link) => isActive(pathname, link.href))
  const [operationsOpen, setOperationsOpen] = useState(operationsActive)
  const showOperations = operationsOpen || operationsActive

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace("/admin/login")
    router.refresh()
  }

  const EventIcon = eventLink.icon

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-card px-4 py-6">
      <div className="mb-8 flex flex-col gap-1 px-2">
        <span className="font-heading text-[0.65rem] font-bold tracking-[0.18em] text-muted-foreground">
          PURPLE SECTOR VISUALS
        </span>
        <span className="font-heading text-sm font-medium text-foreground">Command Center</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {primaryLinks.map((link) => {
          const Icon = link.icon
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(itemClass, isActive(pathname, link.href) && "bg-accent text-foreground")}
            >
              <Icon className="size-4" />
              {link.label}
            </Link>
          )
        })}

        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setOperationsOpen((open) => !open)}
            aria-expanded={showOperations}
            aria-controls="admin-operations-links"
            className={cn(itemClass, "w-full", operationsActive && "text-foreground")}
          >
            <Briefcase className="size-4" />
            Operations
            <ChevronDown
              className={cn("ml-auto size-4 transition-transform", showOperations && "rotate-180")}
            />
          </button>
          {showOperations && (
            <div id="admin-operations-links" className="ml-3 flex flex-col gap-1 border-l border-border pl-2">
              {operationsLinks.map((link) => {
                const Icon = link.icon
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(itemClass, isActive(pathname, link.href) && "bg-accent text-foreground")}
                  >
                    <Icon className="size-4" />
                    {link.label}
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        <Link
          href={eventLink.href}
          className={cn(
            "mt-3 flex items-center gap-2.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-primary/20",
            isActive(pathname, eventLink.href) && "border-primary bg-primary/20"
          )}
        >
          <EventIcon className="size-4 text-primary" />
          {eventLink.label}
        </Link>
      </nav>

      <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
        <span className="px-3 text-xs text-muted-foreground">Signed in as {displayName}</span>
        <button type="button" onClick={handleSignOut} className={cn(itemClass, "text-left")}>
          <LogOut className="size-4" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
