"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Images, LayoutGrid, LogOut } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

const links = [
  { href: "/admin", label: "Overview", icon: LayoutGrid },
  { href: "/admin/galleries", label: "Galleries", icon: Images },
  { href: "/admin/assets", label: "Site Assets", icon: LayoutGrid },
]

export function AdminSidebar({ displayName }: { displayName: string }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace("/admin/login")
    router.refresh()
  }

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-card px-4 py-6">
      <div className="mb-8 flex flex-col gap-1 px-2">
        <span className="font-heading text-[0.65rem] font-bold tracking-[0.18em] text-muted-foreground">
          PURPLE SECTOR VISUALS
        </span>
        <span className="font-heading text-sm font-medium text-foreground">Command Center</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {links.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`)
          const Icon = link.icon
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                active && "bg-accent text-foreground"
              )}
            >
              <Icon className="size-4" />
              {link.label}
            </Link>
          )
        })}
      </nav>

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <span className="px-3 text-xs text-muted-foreground">Signed in as {displayName}</span>
        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <LogOut className="size-4" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
