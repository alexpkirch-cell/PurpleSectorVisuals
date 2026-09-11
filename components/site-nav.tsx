"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { Menu, ShieldCheck, X } from "lucide-react"

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
          "flex w-full max-w-5xl items-center justify-between gap-4 rounded-full border border-zinc-800/60 bg-zinc-950/70 px-4 py-2.5 backdrop-blur-md transition-colors",
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
                    "rounded-full px-3.5 py-2 text-sm font-medium text-zinc-400 transition-colors hover:text-foreground",
                    active && "bg-zinc-900 text-foreground"
                  )}
                >
                  {link.label}
                </Link>
              </li>
            )
          })}
        </ul>

        <div className="hidden shrink-0 items-center gap-2 md:flex">
          <Link
            href="/admin/login"
            aria-label="Open admin login"
            className={cn(
              "inline-flex size-10 items-center justify-center rounded-full border border-zinc-800 text-zinc-400 transition-colors hover:border-[#e829f1] hover:text-foreground",
              pathname.startsWith("/admin") && "border-[#e829f1] text-foreground"
            )}
          >
            <ShieldCheck className="size-4" aria-hidden="true" />
          </Link>
          <Link
            href="/contact"
            className={cn(
              buttonVariants(),
              "rounded-full border border-transparent bg-zinc-900 px-5 text-foreground transition-all duration-500 ease-out hover:scale-[1.02] hover:border-[#e829f1] hover:bg-zinc-900 hover:text-foreground hover:shadow-[0_0_24px_rgba(232,41,241,0.22)]"
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
        <div className="absolute inset-x-4 top-[calc(100%+0.5rem)] rounded-3xl border border-zinc-800/60 bg-zinc-950/95 p-4 backdrop-blur-md md:hidden">
          <ul className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "block rounded-2xl px-4 py-3 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-foreground",
                    pathname === link.href && "bg-zinc-900 text-foreground"
                  )}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-2">
            <Link
              href="/admin/login"
              onClick={() => setOpen(false)}
              className={cn(
                "inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-zinc-800 text-zinc-400 transition-colors hover:border-[#e829f1] hover:text-foreground",
                pathname.startsWith("/admin") && "border-[#e829f1] text-foreground"
              )}
              aria-label="Open admin login"
            >
              <ShieldCheck className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href="/contact"
              onClick={() => setOpen(false)}
              className={cn(
                buttonVariants(),
                "w-full rounded-full bg-zinc-900 text-foreground transition-all duration-500 ease-out hover:border-[#e829f1] hover:shadow-[0_0_24px_rgba(232,41,241,0.22)]"
              )}
            >
              Book Session
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
