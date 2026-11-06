"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Briefcase,
  BookUser,
  FileBarChart,
  GalleryVerticalEnd,
  LayoutGrid,
  LogOut,
  Menu,
  Package,
  PanelsTopLeft,
  ScanFace,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react"

import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type NavLink = { href: string; label: string; icon: LucideIcon }

const navLinks: NavLink[] = [
  { href: "/admin", label: "Overview", icon: LayoutGrid },
  { href: "/admin/portfolio", label: "Portfolio CMS", icon: GalleryVerticalEnd },
  { href: "/admin/site-editor", label: "Site Editor", icon: PanelsTopLeft },
  { href: "/admin/crew", label: "Crew & Roster", icon: UserRoundCheck },
  { href: "/admin/packages", label: "Package Manager", icon: Package },
  { href: "/admin/operations", label: "Operations", icon: Briefcase },
  { href: "/admin/clients", label: "Client Directory", icon: BookUser },
  { href: "/admin/reports", label: "Reports & Search", icon: FileBarChart },
]

const eventLink: NavLink = { href: "/admin/event-upload", label: "Event Uploads", icon: ScanFace }

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin"
  return pathname === href || pathname.startsWith(`${href}/`)
}

const itemClass =
  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"

/** Brand, links and sign-out, shared by the desktop sidebar and the mobile drawer. */
function AdminNavContent({ displayName, onNavigate }: { displayName: string; onNavigate?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    onNavigate?.()
    router.replace("/admin/login")
    router.refresh()
  }

  const EventIcon = eventLink.icon

  return (
    <>
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
              onClick={onNavigate}
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
          onClick={onNavigate}
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
    </>
  )
}

/** Fixed sidebar for md and wider screens. Phones use `AdminMobileNav` instead. */
export function AdminSidebar({ displayName }: { displayName: string }) {
  return (
    <aside className="hidden h-full w-60 shrink-0 flex-col border-r border-border bg-card px-4 py-6 md:flex">
      <AdminNavContent displayName={displayName} />
    </aside>
  )
}

/** Top bar with a hamburger that opens the navigation as a drawer over the page. Hidden from md up. */
export function AdminMobileNav({ displayName }: { displayName: string }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const current = [...navLinks, eventLink].find((link) => isActive(pathname, link.href))

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          aria-label="Open admin menu"
          className="-ml-2 inline-flex size-10 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Menu className="size-5" aria-hidden="true" />
        </SheetTrigger>
        <SheetContent side="left" className="w-72 max-w-[85vw] gap-0 bg-card px-4 py-6 sm:max-w-72">
          <SheetTitle className="sr-only">Admin navigation</SheetTitle>
          <SheetDescription className="sr-only">Move between the admin sections.</SheetDescription>
          <AdminNavContent displayName={displayName} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-col leading-tight">
        <span className="font-heading text-[0.6rem] font-bold tracking-[0.18em] text-muted-foreground">COMMAND CENTER</span>
        <span className="truncate font-heading text-sm font-medium text-foreground">{current?.label ?? "Admin"}</span>
      </div>
    </header>
  )
}
