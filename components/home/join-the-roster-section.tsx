import { RosterApplicationForm } from "@/components/home/roster-application-form"

export type RosterBenefit = { title: string; body: string }

export const JOIN_ROSTER_DEFAULTS = {
  eyebrow: "Join the Roster",
  heading: "Shoot your style. Skip the business headache.",
  body: "We handle clients, contracts, insurance, and getting paid. You keep your eye and your edit. If that sounds like a fit, tell us a little about your work.",
  benefits: [
    {
      title: "60% to 70% of every booking",
      body: "40% for shooting, 20% for editing, plus a 10% bonus when you bring the client.",
    },
    {
      title: "25% print royalties",
      body: "Automatic royalties on every print order from your galleries.",
    },
    {
      title: "Paid before downloads unlock",
      body: "50% retainer, 50% at delivery. No chasing checks.",
    },
    {
      title: "Back office and gear",
      body: "Contracts, disputes, insurance, press credentials, and the shared gear locker.",
    },
  ] as RosterBenefit[],
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

          <ul className="mt-6 flex flex-col gap-3">
            {(copy.benefits ?? []).map((benefit, index) => (
              <li key={index} className="text-sm leading-relaxed text-zinc-500">
                <span className="text-zinc-300">{benefit.title}.</span> {benefit.body}
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:pt-8">
          <RosterApplicationForm />
        </div>
      </div>
    </section>
  )
}
