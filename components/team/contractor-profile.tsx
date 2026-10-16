import Image from "next/image"
import Link from "next/link"
import { User } from "lucide-react"

import type { getPublicContractor } from "@/app/actions/roster"
import { Button } from "@/components/ui/button"

type Contractor = NonNullable<Awaited<ReturnType<typeof getPublicContractor>>>

/** Legacy 1099 contractor profile, still reached from shooter and booking links at /team/<contractor-id>. */
export function ContractorProfile({ contractor }: { contractor: Contractor }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-12 px-4 py-20 sm:px-6 sm:py-28">
      <header className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:gap-10 sm:text-left">
        <div className="relative flex size-32 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground ring-2 ring-[#9D00FF]/60 sm:size-40">
          {contractor.profile_image_url ? (
            <Image
              src={contractor.profile_image_url}
              alt={contractor.name}
              fill
              sizes="160px"
              className="object-cover"
              priority
            />
          ) : (
            <User className="size-10" />
          )}
        </div>
        <div className="flex flex-col items-center gap-4 sm:items-start">
          <span className="font-heading text-xs font-bold tracking-[0.18em] text-muted-foreground">
            PURPLE SECTOR VISUALS
          </span>
          <h1 className="font-heading text-3xl font-medium text-balance text-foreground sm:text-5xl">
            {contractor.name}
          </h1>
          {contractor.bio && (
            <p className="max-w-2xl text-pretty leading-relaxed text-muted-foreground">{contractor.bio}</p>
          )}
          <Button size="lg" render={<Link href={`/book?shooter=${contractor.id}`} />}>
            Book This Shooter
          </Button>
        </div>
      </header>

      {contractor.portfolio_image_urls.length > 0 && (
        <section aria-label={`${contractor.name} portfolio`}>
          <ul className="columns-1 gap-4 sm:columns-2 lg:columns-3">
            {contractor.portfolio_image_urls.map((url, index) => (
              <li key={url} className="mb-4 break-inside-avoid overflow-hidden rounded-lg bg-muted">
                <Image
                  src={url}
                  alt={`${contractor.name} portfolio image ${index + 1}`}
                  width={1200}
                  height={1500}
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  className="h-auto w-full object-cover"
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
