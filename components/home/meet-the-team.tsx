import { Aperture, Camera } from "lucide-react"

import { getPublicTeamMembers } from "@/app/actions/team"

const ICONS = [Camera, Aperture]
const PLACEHOLDERS = ["Founder 1", "Founder 2"]

export async function MeetTheTeam() {
  const team = await getPublicTeamMembers()

  if (team.length === 0) {
    return null
  }

  return (
    <section className="w-full bg-zinc-950">
      <div className="mx-auto max-w-6xl px-6 py-24 sm:px-10">
        <div>
          <p className="font-heading text-xs font-semibold uppercase tracking-[0.3em] text-[#9D00FF]">
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
                className="group relative overflow-hidden rounded-3xl border border-white/10 bg-black/40 backdrop-blur-md transition-all duration-500 ease-out hover:border-[#9D00FF] hover:shadow-[0_0_32px_rgba(157,0,255,0.22)]"
              >
                <div className="relative flex aspect-4/5 w-full items-center justify-center overflow-hidden bg-zinc-950 sm:aspect-16/10">
                  <div className="flex size-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
                    <Icon className="size-6 text-zinc-600" strokeWidth={1.5} />
                  </div>
                </div>

                <div className="relative z-10 flex flex-col gap-2 border-t border-white/5 p-6 sm:p-7">
                  <h3 className="font-heading text-2xl font-bold tracking-tight text-zinc-500">
                    {PLACEHOLDERS[index % PLACEHOLDERS.length]}
                  </h3>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#9D00FF]">
                    Role TBD
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
