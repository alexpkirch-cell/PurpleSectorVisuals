"use client"

import useSWR from "swr"
import { Star } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { MultiSelect } from "@/components/admin/multi-select"
import { listAssignableNames } from "@/app/actions/shoots"
import type { AssignedShooter, ShooterRole } from "@/lib/settlement"
import { cn } from "@/lib/utils"

interface TeamAssignmentProps {
  shooters: AssignedShooter[]
  editors: string[]
  onShootersChange: (shooters: AssignedShooter[]) => void
  onEditorsChange: (editors: string[]) => void
}

/** Keeps the roles coherent: someone always leads, and a lone shooter is never left as "second". */
function normalizeShooters(shooters: AssignedShooter[]): AssignedShooter[] {
  if (shooters.length === 0) return shooters
  const hasLeadTier = shooters.some((s) => s.role === "lead" || s.role === "co_lead")
  if (hasLeadTier) return shooters
  return shooters.map((shooter, index) => (index === 0 ? { ...shooter, role: "lead" } : shooter))
}

export function TeamAssignment({ shooters, editors, onShootersChange, onEditorsChange }: TeamAssignmentProps) {
  const { data: roster = [] } = useSWR("assignable-names", listAssignableNames, { revalidateOnFocus: false })
  const options = roster.map((name) => ({ value: name, label: name }))

  function handleShooterNames(names: string[]) {
    const next = names.map<AssignedShooter>(
      (name) => shooters.find((s) => s.name === name) ?? { name, role: "second" },
    )
    onShootersChange(normalizeShooters(next))
  }

  function setRole(name: string, role: ShooterRole) {
    onShootersChange(
      shooters.map((shooter) => {
        if (shooter.name === name) return { ...shooter, role }
        // Only one star: promoting a new lead demotes the previous solo lead.
        if (role === "lead" && shooter.role === "lead") return { ...shooter, role: "second" }
        return shooter
      }),
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="shooters">Shooters</Label>
        <MultiSelect
          id="shooters"
          options={options}
          value={shooters.map((s) => s.name)}
          onChange={handleShooterNames}
          placeholder="Assign shooters"
          showSelected={false}
        />

        {shooters.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {shooters.map((shooter) => {
              const isLead = shooter.role === "lead"
              const isCoLead = shooter.role === "co_lead"
              return (
                <li
                  key={shooter.name}
                  className="flex items-center justify-between gap-2 rounded-md bg-accent/30 px-2.5 py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-pressed={isLead}
                      aria-label={isLead ? `${shooter.name} is lead shooter` : `Make ${shooter.name} lead shooter`}
                      onClick={() => setRole(shooter.name, "lead")}
                    >
                      <Star
                        className={cn("size-4", isLead ? "fill-amber-400 text-amber-400" : "text-muted-foreground")}
                      />
                    </Button>
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-foreground">{shooter.name}</span>
                      <span className="text-[0.65rem] text-muted-foreground">
                        {isLead ? "Lead shooter" : isCoLead ? "Co-lead shooter" : "Second shooter"}
                      </span>
                    </div>
                  </div>

                  {!isLead && (
                    <Button
                      type="button"
                      variant={isCoLead ? "secondary" : "outline"}
                      size="sm"
                      aria-pressed={isCoLead}
                      onClick={() => setRole(shooter.name, isCoLead ? "second" : "co_lead")}
                    >
                      Co-Lead
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        <p className="text-[0.65rem] text-muted-foreground">
          Lead + second splits the shooters pool 35% / 15%. Lead + co-lead splits it 25% / 25%.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="editors">Editors</Label>
        <MultiSelect
          id="editors"
          options={options}
          value={editors}
          onChange={onEditorsChange}
          placeholder="Assign editors"
        />
      </div>
    </div>
  )
}
