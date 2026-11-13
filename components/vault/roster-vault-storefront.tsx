"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { LockKeyhole, LogOut, ShieldCheck, Users } from "lucide-react"

import { logoutRosterVault, type RosterVaultPlayer } from "@/app/actions/roster-vault"
import { Button } from "@/components/ui/button"

type RosterVaultData = {
  teamName: string
  parentName: string
  players: Omit<RosterVaultPlayer, "team_id" | "sort_order" | "is_active">[]
}

export function RosterVaultStorefront({ data }: { data: RosterVaultData }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const firstName = data.parentName.split(/\s+/)[0]

  function signOut() {
    startTransition(async () => {
      await logoutRosterVault()
      router.refresh()
    })
  }

  return (
    <div className="min-h-svh bg-[#09090b] text-zinc-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 pb-16 pt-8 sm:px-8 sm:pt-12">
        <header className="flex flex-wrap items-start justify-between gap-5 border-b border-zinc-800 pb-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-fuchsia-400">
              <ShieldCheck className="size-4" aria-hidden="true" /> Private team access
            </div>
            <p className="text-sm text-zinc-500">PURPLE SECTOR VISUALS <span className="px-1.5 text-zinc-700">/</span> MEDIA DAY</p>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl">{data.teamName}</h1>
            <p className="text-sm text-zinc-400">Welcome, {firstName}. Choose your player to preview their gallery.</p>
          </div>
          <Button type="button" variant="outline" onClick={signOut} disabled={pending} className="border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-900 hover:text-white">
            <LogOut className="size-4" aria-hidden="true" />
            {pending ? "Signing out…" : "Sign out"}
          </Button>
        </header>

        <section className="flex flex-col gap-5" aria-labelledby="players-heading">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Media day roster</p>
              <h2 id="players-heading" className="mt-1 font-heading text-xl font-semibold text-white">Select a player</h2>
            </div>
            <p className="flex items-center gap-1.5 text-xs text-zinc-500"><Users className="size-3.5" aria-hidden="true" />{data.players.length} player{data.players.length === 1 ? "" : "s"}</p>
          </div>

          {data.players.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/60 px-6 text-center">
              <Users className="size-8 text-zinc-600" aria-hidden="true" />
              <h3 className="font-heading text-lg font-semibold text-white">Roster coming soon</h3>
              <p className="max-w-sm text-sm leading-relaxed text-zinc-500">Your team organizer is still adding player cards. Please check back later.</p>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
              {data.players.map((player) => (
                <li key={player.id} className="group min-w-0 overflow-hidden rounded-2xl border border-zinc-800 bg-[#111114] transition-colors hover:border-zinc-700">
                  <article className="flex h-full flex-col">
                    <div className="relative aspect-square overflow-hidden bg-zinc-900">
                      {player.cover_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element -- covers are supplied from the admin CMS and may use a configured storage host
                        <img
                          src={player.cover_image_url}
                          alt={`${player.display_name}, jersey number ${player.jersey_number}`}
                          loading="lazy"
                          className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="relative flex size-full items-center justify-center overflow-hidden bg-gradient-to-br from-zinc-800 via-zinc-950 to-black">
                          <span className="absolute left-4 top-4 font-mono text-[0.6rem] uppercase tracking-[0.24em] text-zinc-500">Player card</span>
                          <span className="select-none font-heading text-7xl font-black leading-none tracking-tighter text-zinc-100 sm:text-8xl">{player.jersey_number}</span>
                          <span className="absolute bottom-4 right-4 font-mono text-xs font-semibold tracking-[0.16em] text-fuchsia-400">JERSEY</span>
                        </div>
                      )}
                      {player.cover_image_url ? (
                        <span className="absolute left-3 top-3 rounded-md border border-white/15 bg-black/70 px-2 py-1 font-mono text-xs font-semibold text-white backdrop-blur-sm">#{player.jersey_number}</span>
                      ) : null}
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/55 to-transparent" />
                    </div>

                    <div className="flex flex-1 flex-col items-center gap-3 px-3 pb-4 pt-4 text-center sm:px-4">
                      <h3 className="line-clamp-2 min-h-10 font-heading text-base font-semibold leading-snug text-zinc-100 sm:text-lg">{player.display_name}</h3>
                      <Button type="button" disabled className="mt-auto w-full cursor-not-allowed border border-zinc-800 bg-zinc-900 text-zinc-500 opacity-100" aria-label={`Unlock gallery for ${player.display_name} (coming soon)`}>
                        <LockKeyhole className="size-3.5" aria-hidden="true" />
                        Unlock Gallery
                      </Button>
                      <span className="text-[0.65rem] uppercase tracking-[0.15em] text-zinc-600">Coming soon</span>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="border-t border-zinc-900 pt-5 text-center text-xs text-zinc-600">Private access for {data.teamName} families</footer>
      </div>
    </div>
  )
}
