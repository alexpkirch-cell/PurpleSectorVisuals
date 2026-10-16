import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { MemberHero } from "@/components/team/member-hero"
import { isVideoUrl, type DirectoryMember } from "@/lib/team-directory"

export function MemberProfile({ member }: { member: DirectoryMember }) {
  return (
    <main className="flex min-h-screen flex-col">
      <MemberHero member={member} />

      {member.highlight_media.length > 0 ? (
        <section aria-label={`${member.name} highlights`} className="flex w-full flex-col gap-6 px-3 pt-8 pb-24 sm:px-6">
          <h2 className="font-mono text-xs tracking-[0.25em] text-primary uppercase">Highlights</h2>
          <ul className="columns-1 gap-3 sm:columns-2 sm:gap-4 lg:columns-3 2xl:columns-4">
            {member.highlight_media.map((url, index) => (
              <li key={`${url}-${index}`} className="mb-3 break-inside-avoid overflow-hidden rounded-xl bg-muted sm:mb-4">
                {isVideoUrl(url) ? (
                  <video
                    src={url}
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="metadata"
                    aria-label={`${member.name} highlight video ${index + 1}`}
                    className="h-auto w-full"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt={`${member.name} highlight ${index + 1}`}
                    loading="lazy"
                    className="h-auto w-full"
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex justify-center pt-16 pb-20">
        <Link
          href="/team"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to the full team
        </Link>
      </div>
    </main>
  )
}
