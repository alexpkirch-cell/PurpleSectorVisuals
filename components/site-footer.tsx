import Link from "next/link"

import { navLinks } from "@/lib/site-data"

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-16 sm:px-10">
        <div className="flex flex-col justify-between gap-8 sm:flex-row sm:items-end">
          <div>
            <p className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Let&apos;s shoot something worth remembering.
            </p>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              Purple Sector Visuals &mdash; a two-creator studio built for sports,
              automotive, portrait, and event coverage.
            </p>
          </div>
          <Link
            href="/contact"
            className="inline-flex w-fit items-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Book Session
          </Link>
        </div>

        <div className="flex flex-col gap-6 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Purple Sector Visuals. All rights
            reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
