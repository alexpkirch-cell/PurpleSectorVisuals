import type { ReactNode } from "react"

export const HOW_WE_WORK_DEFAULTS = {
  eyebrow: "How We Work",
  heading: "One Production House. Every Visual Style.",
  body: "Traditional photography studios force your brand or milestone into a single, generic template. Purple Sector Visuals is built differently. We are a curated collective of specialized visual creators across the Grand Valley. Whether you need high-speed motorsport coverage, commercial brand storytelling, architectural precision, or signature portraits, we match your project with the exact visual specialist built for the brief—backed by one seamless contract, insured production, and instant digital delivery through The Vault.",
}

type HowWeWorkSectionProps = {
  eyebrow?: ReactNode
  heading?: ReactNode
  body?: ReactNode
}

export function HowWeWorkSection({
  eyebrow = HOW_WE_WORK_DEFAULTS.eyebrow,
  heading = HOW_WE_WORK_DEFAULTS.heading,
  body = HOW_WE_WORK_DEFAULTS.body,
}: HowWeWorkSectionProps) {
  // In the Puck editor an inline-editable `body` arrives as an element, not a string.
  const paragraphs = typeof body === "string" ? body.split(/\n{2,}/).filter(Boolean) : [body]

  return (
    <section className="w-full bg-[#09090b]">
      <div className="mx-auto max-w-3xl px-6 py-24 text-center sm:px-10">
        {eyebrow ? (
          <p className="font-heading text-xs font-semibold uppercase tracking-[0.3em] text-[#e829f1]">{eyebrow}</p>
        ) : null}
        {heading ? (
          <h2 className="mt-4 text-balance font-heading text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            {heading}
          </h2>
        ) : null}
        {paragraphs.map((paragraph, index) => (
          <p key={index} className="mt-6 text-pretty text-base leading-relaxed text-zinc-400">
            {paragraph}
          </p>
        ))}
      </div>
    </section>
  )
}
