"use client"

import { useMemo, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Search, X } from "lucide-react"
import useSWR from "swr"

import { TeamCard } from "@/components/team/team-card"
import { createClient } from "@/lib/supabase/client"
import { uniqueSorted, type DirectoryMember } from "@/lib/team-directory"
import { cn } from "@/lib/utils"

async function fetchActiveMembers(): Promise<DirectoryMember[]> {
  const { data, error } = await createClient()
    .from("team_members")
    .select("id, slug, name, bio, cutout_image_url, highlight_media, roles, specialties, is_active, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
  if (error) throw error
  return (data ?? []) as DirectoryMember[]
}

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

function FilterPill({ label, pressed, onClick }: { label: string; pressed: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-1.5 font-mono text-xs tracking-wider uppercase transition-colors",
        pressed
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:border-primary/60 hover:text-foreground"
      )}
    >
      {label}
    </button>
  )
}

export function TeamDirectory() {
  const { data: members, error, isLoading } = useSWR("team-members-active", fetchActiveMembers)
  const reduceMotion = useReducedMotion()
  const [query, setQuery] = useState("")
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([])

  const roleOptions = useMemo(() => uniqueSorted((members ?? []).flatMap((m) => m.roles)), [members])
  const specialtyOptions = useMemo(() => uniqueSorted((members ?? []).flatMap((m) => m.specialties)), [members])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return (members ?? []).filter((member) => {
      if (needle && !member.name.toLowerCase().includes(needle) && !member.bio.toLowerCase().includes(needle)) return false
      if (selectedRoles.length > 0 && !member.roles.some((role) => selectedRoles.includes(role))) return false
      if (selectedSpecialties.length > 0 && !member.specialties.some((s) => selectedSpecialties.includes(s))) return false
      return true
    })
  }, [members, query, selectedRoles, selectedSpecialties])

  const filtersActive = query.trim() !== "" || selectedRoles.length > 0 || selectedSpecialties.length > 0

  function clearAll() {
    setQuery("")
    setSelectedRoles([])
    setSelectedSpecialties([])
  }

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-4">
        <span className="font-mono text-xs tracking-[0.25em] text-primary uppercase">The Roster</span>
        <h1 className="font-heading text-5xl font-medium text-balance text-foreground sm:text-7xl">Meet the team</h1>
        <p className="max-w-2xl text-lg leading-relaxed text-pretty text-muted-foreground">
          The shooters, editors and operators behind every Purple Sector frame. Hover a card for a look at their work.
        </p>
      </header>

      <section aria-label="Filter the team" className="flex flex-col gap-5 rounded-2xl border border-border bg-card/60 p-4 sm:p-6">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or bio"
            aria-label="Search team members"
            className="h-12 w-full rounded-xl border border-input bg-background pr-10 pl-11 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute top-1/2 right-3 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        {roleOptions.length > 0 ? (
          <div className="flex flex-col gap-2" role="group" aria-label="Filter by role">
            <span className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">Roles</span>
            <div className="flex flex-wrap gap-2">
              {roleOptions.map((role) => (
                <FilterPill
                  key={role}
                  label={role}
                  pressed={selectedRoles.includes(role)}
                  onClick={() => setSelectedRoles((list) => toggle(list, role))}
                />
              ))}
            </div>
          </div>
        ) : null}

        {specialtyOptions.length > 0 ? (
          <div className="flex flex-col gap-2" role="group" aria-label="Filter by specialty">
            <span className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">Specialties</span>
            <div className="flex flex-wrap gap-2">
              {specialtyOptions.map((specialty) => (
                <FilterPill
                  key={specialty}
                  label={specialty}
                  pressed={selectedSpecialties.includes(specialty)}
                  onClick={() => setSelectedSpecialties((list) => toggle(list, specialty))}
                />
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-4">
          <p role="status" aria-live="polite" className="font-mono text-xs text-muted-foreground">
            {isLoading ? "Loading roster" : `${filtered.length} of ${members?.length ?? 0} shown`}
          </p>
          {filtersActive ? (
            <button type="button" onClick={clearAll} className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">
              Clear filters
            </button>
          ) : null}
        </div>
      </section>

      {error ? (
        <p role="alert" className="rounded-xl border border-destructive/40 p-6 text-sm text-destructive">
          The roster could not be loaded. Refresh the page to try again.
        </p>
      ) : isLoading ? (
        <ul className="grid grid-cols-1 gap-6 xl:grid-cols-2" aria-hidden="true">
          {[0, 1].map((key) => (
            <li key={key} className="h-80 animate-pulse rounded-2xl border border-border bg-card sm:h-96" />
          ))}
        </ul>
      ) : !members?.length ? null : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-12 text-center">
          <p className="text-foreground">No one matches those filters.</p>
          <button type="button" onClick={clearAll} className="text-sm text-primary underline underline-offset-4">
            Reset filters
          </button>
        </div>
      ) : (
        <motion.ul layout={!reduceMotion} className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <AnimatePresence mode="popLayout" initial={false}>
            {filtered.map((member) => (
              <motion.li
                key={member.id}
                layout={!reduceMotion}
                initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.96 }}
                transition={{ duration: reduceMotion ? 0 : 0.25 }}
              >
                <TeamCard member={member} />
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
    </div>
  )
}
