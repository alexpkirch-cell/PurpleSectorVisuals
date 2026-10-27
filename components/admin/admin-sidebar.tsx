"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Briefcase,
  CalendarCheck,
  GalleryVerticalEnd,
  Images,
  LayoutGrid,
  LogOut,
  Package,
  PanelsTopLeft,
  ScanFace,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type NavLink = { href: string; label: string; icon: LucideIcon }

const navLinks: NavLink[] = [
  { href: "/admin", label: "Overview", icon: LayoutGrid },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarCheck },
  { href: "/admin/vaults", label: "Vaults", icon: Images },
  { href: "/admin/portfolio", label: "Portfolio CMS", icon: GalleryVerticalEnd },
  { href: "/admin/site-editor", label: "Site Editor", icon: PanelsTopLeft },
  { href: "/admin/crew", label: "Crew & Roster", icon: UserRoundCheck },
  { href: "/admin/packages", label: "Package Manager", icon: Package },
  { href: "/admin/operations", label: "Operations", icon: Briefcase },
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

      <nav aria-label="Admin" className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {navLinks.map((link) => {
          const Icon = link.icon
          const active = isActive(pathname, link.href)
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={cn(itemClass, active && "bg-accent text-foreground")}
            >
              <Icon className="size-4" />
              {link.label}
            </Link>
          )
        })}

        <Link
          href={eventLink.href}
          aria-current={isActive(pathname, eventLink.href) ? "page" : undefined}
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
