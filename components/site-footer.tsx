import Link from "next/link"

import { navLinks } from "@/lib/site-data"

const INSTAGRAM_URL = "https://instagram.com/purplesectorvisuals"

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function SiteFooter() {
  return (
    <footer className="border-t border-zinc-800/80 bg-[#09090b]">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-16 sm:px-10">
        <div className="flex flex-col justify-between gap-8 sm:flex-row sm:items-end">
          <div>
            <p className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Purple Sector Visuals.
            </p>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-500">
              Independent media production in Grand Junction, Colorado.
            </p>
          </div>
          <Link
            href="/contact"
            className="inline-flex w-fit items-center rounded-full border border-transparent bg-zinc-900 px-6 py-3 text-sm font-medium text-foreground transition-all duration-500 ease-out hover:scale-[1.02] hover:border-[#e829f1] hover:shadow-[0_0_24px_rgba(232,41,241,0.22)]"
          >
            Book Session
          </Link>
        </div>

        <div className="flex flex-col gap-6 border-t border-zinc-800/80 pt-8 md:flex-row md:items-center md:justify-between">
          <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-4 gap-y-3 sm:gap-x-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-zinc-500 transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Purple Sector Visuals on Instagram (opens in a new tab)"
              className="-m-2 inline-flex size-9 items-center justify-center rounded-full text-zinc-500 transition-colors hover:text-[#e829f1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <InstagramIcon className="size-5" />
            </a>
          </nav>
          <p className="text-xs text-zinc-600">
            &copy; {new Date().getFullYear()} Purple Sector Visuals. All rights
            reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
