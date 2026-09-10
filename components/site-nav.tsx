"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { Menu, X } from "lucide-react"

import { navLinks } from "@/lib/site-data"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function SiteNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <header className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <nav
        className={cn(
          "flex w-full max-w-5xl items-center justify-between gap-4 rounded-full border border-border bg-card/60 px-4 py-2.5 backdrop-blur-xl transition-colors",
          "sm:px-6"
        )}
      >
        <Link
          href="/"
          className="shrink-0 font-heading text-xs font-bold tracking-[0.18em] text-foreground sm:text-sm"
          onClick={() => setOpen(false)}
        >
          PURPLE SECTOR VISUALS
        </Link>

        <ul className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => {
            const active = pathname === link.href
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={cn(
                    "rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                    active && "bg-secondary text-foreground"
                  )}
                >
                  {link.label}
                </Link>
              </li>
            )
          })}
        </ul>

        <div className="hidden shrink-0 md:block">
          <Link
            href="/contact"
            className={cn(
              buttonVariants(),
              "rounded-full bg-primary px-5 text-primary-foreground shadow-[0_0_24px_-4px_var(--color-primary)] hover:bg-primary/90"
            )}
          >
            Book Session
          </Link>
        </div>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex size-9 items-center justify-center rounded-full text-foreground md:hidden"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </nav>

      {open && (
        <div className="absolute inset-x-4 top-[calc(100%+0.5rem)] rounded-3xl border border-border bg-card/95 p-4 backdrop-blur-xl md:hidden">
          <ul className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "block rounded-2xl px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                    pathname === link.href && "bg-secondary text-foreground"
                  )}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/contact"
            onClick={() => setOpen(false)}
            className={cn(
              buttonVariants(),
              "mt-2 w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            Book Session
          </Link>
        </div>
      )}
    </header>
  )
}
