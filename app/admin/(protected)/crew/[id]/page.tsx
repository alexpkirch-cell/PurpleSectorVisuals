import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { getCrewMember } from "@/app/actions/crew"
import { CrewProfileEditor } from "@/components/admin/crew/crew-profile-editor"

export const metadata: Metadata = {
  title: "Shooter | 1099 Crew Hub",
  robots: { index: false, follow: false },
}

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })

export default async function CrewMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await getCrewMember(id)
  if (!result) notFound()

  const { member, financials, contractUrl } = result
  const year = new Date().getFullYear()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/crew"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          1099 Crew Hub
        </Link>
        <h1 className="mt-3 font-heading text-2xl font-medium text-foreground">{member.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {member.email} · {member.is_active ? "Active" : "Archived"} · W-9 {member.w9_status}
        </p>
      </div>

      <section aria-label="Financial summary" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Bookings completed</p>
          <p className="mt-2 font-heading text-2xl font-medium text-foreground">{financials.bookingsCompleted}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{year} gross booked</p>
          <p className="mt-2 font-heading text-2xl font-medium text-foreground">{currency.format(financials.ytdGross)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {year} earned ({financials.sharePercent}% share)
          </p>
          <p className="mt-2 font-heading text-2xl font-medium text-foreground">{currency.format(financials.ytdEarned)}</p>
        </div>
      </section>

      <CrewProfileEditor member={member} contractUrl={contractUrl} />

      <section aria-label="Portfolio photos" className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-medium text-foreground">
          Portfolio ({member.portfolio_image_urls.length})
        </h2>
        {member.portfolio_image_urls.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No portfolio photos uploaded yet.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {member.portfolio_image_urls.map((url, index) => (
              <li key={url} className="relative aspect-[4/5] overflow-hidden rounded-lg bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of an uploaded public asset */}
                <img
                  src={url}
                  alt={`${member.name} portfolio photo ${index + 1}`}
                  crossOrigin="anonymous"
                  className="absolute inset-0 size-full object-cover"
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
