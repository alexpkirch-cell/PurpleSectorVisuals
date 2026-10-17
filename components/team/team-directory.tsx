"use client"

import { useMemo, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { ListFilter, Search, X } from "lucide-react"
import useSWR from "swr"

import { TeamCard } from "@/components/team/team-card"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { createClient } from "@/lib/supabase/client"
import { uniqueSorted, type DirectoryMember } from "@/lib/team-directory"

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

function FilterGroup({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string
  options: string[]
  selected: string[]
  onToggle: (value: string) => void
}) {
  if (options.length === 0) return null
  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="mb-1 font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">{title}</legend>
      {options.map((option) => (
        <label key={option} className="flex cursor-pointer items-center gap-3 text-sm text-foreground">
          <Checkbox checked={selected.includes(option)} onCheckedChange={() => onToggle(option)} />
          {option}
        </label>
      ))}
    </fieldset>
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

  const activeFilterCount = selectedRoles.length + selectedSpecialties.length
  const filtersActive = query.trim() !== "" || activeFilterCount > 0
  const hasFilterOptions = roleOptions.length > 0 || specialtyOptions.length > 0

  function clearAll() {
    setQuery("")
    setSelectedRoles([])
    setSelectedSpecialties([])
  }

  return (
    <div className="flex flex-col gap-12">
      <header className="flex flex-col gap-4">
        <span className="font-mono text-xs tracking-[0.25em] text-primary uppercase">The Roster</span>
        <h1 className="font-heading text-5xl font-medium text-balance text-foreground sm:text-7xl">Meet the team</h1>
        <p className="max-w-2xl text-lg leading-relaxed text-pretty text-muted-foreground">
          The shooters, editors and operators behind every Purple Sector frame.
        </p>
      </header>

      <section aria-label="Search and filter the team" className="flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or bio"
            aria-label="Search team members"
            className="h-14 w-full rounded-2xl border border-input bg-card pr-44 pl-11 text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-search-cancel-button]:hidden"
          />
          <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1">
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            ) : null}
            <Popover>
              <PopoverTrigger
                disabled={!hasFilterOptions}
                aria-label="Filter by role and specialty"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors outline-none hover:border-primary/60 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ListFilter className="size-4" aria-hidden="true" />
                Filter
                {activeFilterCount > 0 ? (
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 font-mono text-[11px] text-primary-foreground">
                    {activeFilterCount}
                  </span>
                ) : null}
              </PopoverTrigger>
              <PopoverContent align="end" className="flex flex-col gap-5">
                <FilterGroup
                  title="Roles"
                  options={roleOptions}
                  selected={selectedRoles}
                  onToggle={(value) => setSelectedRoles((list) => toggle(list, value))}
                />
                <FilterGroup
                  title="Specialties"
                  options={specialtyOptions}
                  selected={selectedSpecialties}
                  onToggle={(value) => setSelectedSpecialties((list) => toggle(list, value))}
                />
                {activeFilterCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRoles([])
                      setSelectedSpecialties([])
                    }}
                    className="self-start text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                  >
                    Clear selections
                  </button>
                ) : null}
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 px-1">
          <p role="status" aria-live="polite" className="font-mono text-xs text-muted-foreground">
            {isLoading ? "Loading roster" : `${filtered.length} of ${members?.length ?? 0} shown`}
          </p>
          {filtersActive ? (
            <button type="button" onClick={clearAll} className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">
              Clear all
            </button>
          ) : null}
        </div>
      </section>

      {error ? (
        <p role="alert" className="rounded-xl border border-destructive/40 p-6 text-sm text-destructive">
          The roster could not be loaded. Refresh the page to try again.
        </p>
      ) : isLoading ? (
        <ul className="flex flex-col gap-16" aria-hidden="true">
          {[0, 1].map((key) => (
            <li key={key} className="mt-24 h-[26rem] animate-pulse rounded-3xl border border-border bg-card" />
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
        <motion.ul layout={!reduceMotion} className="flex flex-col gap-16">
          <AnimatePresence mode="popLayout" initial={false}>
            {filtered.map((member, index) => (
              <motion.li
                key={member.id}
                layout={!reduceMotion}
                initial={{ opacity: 0, y: reduceMotion ? 0 : 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduceMotion ? 0 : 24 }}
                transition={{ duration: reduceMotion ? 0 : 0.3 }}
              >
                <TeamCard member={member} reversed={index % 2 === 1} />
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
    </div>
  )
}
