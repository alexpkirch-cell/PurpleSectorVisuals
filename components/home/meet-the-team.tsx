import Image from "next/image"
import { Aperture, Camera } from "lucide-react"

import { getPublicTeamMembers } from "@/app/actions/team"

const ICONS = [Camera, Aperture]

export async function MeetTheTeam() {
  const team = await getPublicTeamMembers()

  if (team.length === 0) {
    return null
  }

  return (
    <section className="w-full bg-[#09090b]">
      <div className="mx-auto max-w-6xl px-6 py-24 sm:px-10">
        <div>
          <p className="font-heading text-xs font-semibold uppercase tracking-[0.3em] text-primary">
            The Team
          </p>
          <h2 className="mt-4 max-w-xl text-balance font-heading text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Meet the founders.
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {team.map((member, index) => {
            const Icon = ICONS[index % ICONS.length]
            return (
              <div
                key={member.id}
                className="group relative overflow-hidden rounded-3xl border border-white/10 bg-black/40 backdrop-blur-md transition-all duration-500 ease-out hover:border-primary hover:shadow-[0_0_32px_rgba(232,41,241,0.22)]"
              >
                <div className="relative aspect-4/5 w-full overflow-hidden sm:aspect-16/10">
                  <Image
                    src={member.photo_url || "/placeholder.svg"}
                    alt={`Portrait of ${member.name}, ${member.title}`}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                  <div className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full border border-white/15 bg-black/50 backdrop-blur-md">
                    <Icon className="size-4 text-primary" strokeWidth={1.5} />
                  </div>
                </div>

                <div className="relative z-10 flex flex-col gap-2 p-6 sm:p-7">
                  <h3 className="font-heading text-2xl font-bold tracking-tight text-foreground">
                    {member.name}
                  </h3>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">
                    {member.title}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-400">{member.bio}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
