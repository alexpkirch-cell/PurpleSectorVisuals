import { Aperture, Crosshair } from "lucide-react"

const rigs = [
  {
    key: "alex",
    body: "LUMIX G9 II + 100-300mm f/4.0-5.6",
    sub: "Alex — High-reach telephoto / Kinetic sports & action tracking",
    tag: "AF-C 60FPS BURST",
  },
  {
    key: "gabe",
    body: "FULL-FRAME PRIME RIG // [RESERVED]",
    sub: "Gabe — Atmosphere / Low-light portraits & street",
    tag: "WIDE APERTURE // TONAL",
  },
]

export function HardwareRigShowcase() {
  return (
    <div className="relative mx-auto w-full max-w-4xl">
      {/* HUD framing brackets */}
      <span className="absolute -left-2 -top-2 size-6 border-l border-t border-zinc-700 sm:size-8" />
      <span className="absolute -right-2 -top-2 size-6 border-r border-t border-zinc-700 sm:size-8" />
      <span className="absolute -bottom-2 -left-2 size-6 border-b border-l border-zinc-700 sm:size-8" />
      <span className="absolute -bottom-2 -right-2 size-6 border-b border-r border-zinc-700 sm:size-8" />

      <div className="relative flex items-center justify-center overflow-hidden rounded-[28px] border border-zinc-800/70 bg-gradient-to-b from-zinc-950/80 to-[#0d0d0f] px-4 py-10 sm:px-10 sm:py-16">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(#e4e4e7 1px, transparent 1px), linear-gradient(90deg, #e4e4e7 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* center focus reticle */}
        <Crosshair
          className="pointer-events-none absolute left-1/2 top-1/2 z-10 size-6 -translate-x-1/2 -translate-y-1/2 text-zinc-700"
          strokeWidth={1}
        />

        {/* glowing divider */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-20 w-px -translate-x-1/2 -translate-y-1/2 bg-gradient-to-b from-transparent via-[#e829f1]/70 to-transparent sm:h-28" />

        {rigs.map((rig) => (
          <div
            key={rig.key}
            className="group relative z-10 flex flex-1 flex-col items-center gap-4 px-4 sm:px-10"
          >
            <div className="relative flex size-20 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950 transition-all duration-500 ease-out group-hover:scale-105 group-hover:border-[#e829f1] group-hover:shadow-[0_0_28px_rgba(232,41,241,0.45)] sm:size-28">
              <Aperture
                className="size-9 text-zinc-500 transition-colors duration-500 ease-out group-hover:text-[#e829f1] sm:size-11"
                strokeWidth={1.25}
              />
            </div>

            <div className="flex flex-col items-center gap-1 text-center">
              <p className="font-heading text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground sm:text-xs">
                {rig.body}
              </p>
              <p className="max-w-[200px] text-[10px] leading-relaxed text-zinc-500 sm:max-w-[240px] sm:text-[11px]">
                {rig.sub}
              </p>
            </div>

            <span className="rounded-full border border-[#e829f1]/0 bg-[#e829f1]/0 px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-[#e829f1] opacity-0 transition-all duration-500 ease-out group-hover:border-[#e829f1]/40 group-hover:bg-[#e829f1]/10 group-hover:opacity-100">
              {rig.tag}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
