import type { Metadata } from "next"

import { TeamDirectory } from "@/components/team/team-directory"

export const metadata: Metadata = {
  title: "Team | Purple Sector Visuals",
  description:
    "Meet the shooters, editors and operators behind Purple Sector Visuals. Search the roster by name, role or specialty.",
}

export default function TeamPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 pt-32 pb-24 sm:px-6">
      <TeamDirectory />
    </main>
  )
}
