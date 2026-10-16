import { RosterApplicationForm } from "@/components/home/roster-application-form"

export type RosterBenefit = { title: string; body: string }

export const JOIN_ROSTER_DEFAULTS = {
  eyebrow: "Join the Roster",
  heading: "Interested in joining the roster?",
  body: "You shoot your style. We handle the business. If you're a high-end creator looking to plug into a commercial agency machine, send us your portfolio.",
  benefits: [] as RosterBenefit[],
}

export type JoinRosterText = Partial<typeof JOIN_ROSTER_DEFAULTS>

export function JoinTheRosterSection({ text }: { text?: JoinRosterText }) {
  const copy = { ...JOIN_ROSTER_DEFAULTS, ...text }

  return (
    <section id="join-the-roster" className="w-full border-t border-zinc-900 bg-black">
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-12 px-6 py-16 sm:px-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">{copy.eyebrow}</p>
          <h2 className="mt-3 text-balance font-heading text-xl font-medium tracking-tight text-zinc-200 sm:text-2xl">
            {copy.heading}
          </h2>
          <p className="mt-3 max-w-md text-pretty text-sm leading-relaxed text-zinc-500">{copy.body}</p>

          {copy.benefits?.length ? (
            <ul className="mt-6 flex flex-col gap-3">
              {copy.benefits.map((benefit, index) => (
                <li key={index} className="text-sm leading-relaxed text-zinc-500">
                  <span className="text-zinc-300">{benefit.title}.</span> {benefit.body}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="lg:pt-8">
          <RosterApplicationForm />
        </div>
      </div>
    </section>
  )
}
