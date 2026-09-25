const BENEFITS = [
  {
    title: "Keep 60% to 70% of Every Booking",
    body: "Earn 40% for shooting, 20% for editing, and an extra 10% origination bonus (70% total) whenever you bring your own client into the PSV system.",
  },
  {
    title: "25% Passive Print Royalties",
    body: "Earn automatic royalties every time a client orders prints or wall art from your galleries inside The Vault.",
  },
  {
    title: "Zero Chasing Checks",
    body: "Our 20% deposit / 80% gallery paywall system guarantees clients pay before downloads unlock.",
  },
  {
    title: "Full Back-Office & Gear Support",
    body: "PSV handles all client disputes, commercial contracts, liability insurance, press credentials, and access to the shared PSV Gear Locker.",
  },
]

export function JoinTheRosterSection() {
  return (
    <section id="join-the-roster" className="w-full bg-black">
      <div className="mx-auto max-w-5xl px-6 py-24 sm:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-heading text-xs font-semibold uppercase tracking-[0.3em] text-[#e829f1]">
            Join the Roster
          </p>
          <h2 className="mt-4 text-balance font-heading text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Shoot Your Style. Skip the Business Headache.
          </h2>
          <p className="mt-6 text-pretty text-base leading-relaxed text-zinc-400">
            You got into photography to create—not to chase late invoices, draft legal contracts, pay for gallery
            software, or haggle over rates in Instagram DMs. When you join the Purple Sector Visuals roster, you keep
            your distinct editing and shooting style while plugging into a commercial agency machine:
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {BENEFITS.map((benefit) => (
            <div
              key={benefit.title}
              className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6 transition-colors duration-500 hover:border-[#e829f1]/50"
            >
              <h3 className="font-heading text-lg font-semibold text-foreground">{benefit.title}</h3>
              <p className="mt-2 text-pretty text-sm leading-relaxed text-zinc-400">{benefit.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
