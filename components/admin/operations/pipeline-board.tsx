"use client"

import { useState } from "react"
import { Calendar, Camera, MoreVertical, Package, Trash2, XCircle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Shoot } from "@/app/actions/shoots"
import {
  formatShootDate,
  leadShooterOf,
  PIPELINE_STAGES,
  STATUS_LABELS,
  stageForStatus,
  type PipelineStage,
} from "@/lib/operations"
import { cn } from "@/lib/utils"

interface PipelineBoardProps {
  shoots: Shoot[]
  onMove: (shoot: Shoot, stage: PipelineStage) => void
  onOpen: (shoot: Shoot) => void
  onDecline: (shoot: Shoot) => void
  onDelete: (shoot: Shoot) => void
  onGenerateVault: (shoot: Shoot) => void
}

export function PipelineBoard({ shoots, onMove, onOpen, onDecline, onDelete, onGenerateVault }: PipelineBoardProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)

  function handleDrop(stage: PipelineStage) {
    const shoot = shoots.find((s) => s.id === draggingId)
    setDraggingId(null)
    setDragOverStage(null)
    if (shoot) onMove(shoot, stage)
  }

  return (
    <section aria-label="Shoot pipeline" className="flex gap-3 overflow-x-auto pb-2">
      {PIPELINE_STAGES.map((stage) => {
        const cards = shoots.filter((s) => stageForStatus(s.status)?.id === stage.id)
        const isDragOver = dragOverStage === stage.id

        return (
          <div
            key={stage.id}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOverStage(stage.id)
            }}
            onDragLeave={() => setDragOverStage((current) => (current === stage.id ? null : current))}
            onDrop={(e) => {
              e.preventDefault()
              handleDrop(stage)
            }}
            className={cn(
              "flex min-h-64 min-w-64 flex-1 basis-0 flex-col gap-2 rounded-xl border p-2.5 transition-colors",
              isDragOver ? "border-primary bg-primary/5" : "border-border bg-card/40",
            )}
          >
            <div className="flex flex-col gap-0.5 px-1 pb-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">{stage.label}</h3>
                <span className="flex size-5 items-center justify-center rounded-full bg-muted text-xs font-medium tabular-nums text-muted-foreground">
                  {cards.length}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{stage.hint}</p>
            </div>

            {cards.length === 0 ? (
              <p className="px-1 py-6 text-center text-xs text-muted-foreground">Drop a shoot here</p>
            ) : (
              <div className="flex flex-col gap-2">
                {cards.map((shoot) => {
                  const shooter = leadShooterOf(shoot)
                  const date = formatShootDate(shoot.shoot_date)
                  const showStatus = stage.statuses.length > 1

                  return (
                    <div
                      key={shoot.id}
                      role="button"
                      tabIndex={0}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move"
                        e.dataTransfer.setData("text/plain", shoot.id)
                        setDraggingId(shoot.id)
                      }}
                      onDragEnd={() => {
                        setDraggingId(null)
                        setDragOverStage(null)
                      }}
                      onClick={() => onOpen(shoot)}
                      onKeyDown={(e) => {
                        if (e.target !== e.currentTarget) return
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          onOpen(shoot)
                        }
                      }}
                      className={cn(
                        "flex cursor-grab flex-col gap-2 rounded-lg border border-border bg-card p-3 text-left shadow-sm transition-colors hover:border-primary/40 active:cursor-grabbing",
                        draggingId === shoot.id && "opacity-50",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 truncate text-sm font-medium text-foreground">{shoot.client_name}</p>

                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <button
                                type="button"
                                aria-label={`Move or manage ${shoot.client_name}`}
                                onClick={(e) => e.stopPropagation()}
                                className="-m-1 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                              />
                            }
                          >
                            <MoreVertical className="size-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            {PIPELINE_STAGES.filter((s) => s.id !== stage.id).map((target) => (
                              <DropdownMenuItem key={target.id} onClick={() => onMove(shoot, target)}>
                                Move to {target.label}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => onDecline(shoot)}>
                              <XCircle className="size-3.5" />
                              Decline
                            </DropdownMenuItem>
                            <DropdownMenuItem variant="destructive" onClick={() => onDelete(shoot)}>
                              <Trash2 className="size-3.5" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <dl className="flex flex-col gap-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <dt className="sr-only">Shoot date</dt>
                          <Calendar className="size-3.5 shrink-0" aria-hidden="true" />
                          <dd>{date ?? "Date TBD"}</dd>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <dt className="sr-only">Lead shooter</dt>
                          <Camera className="size-3.5 shrink-0" aria-hidden="true" />
                          <dd>{shooter ?? "Unassigned"}</dd>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <dt className="sr-only">Package</dt>
                          <Package className="size-3.5 shrink-0" aria-hidden="true" />
                          <dd className="truncate">
                            {shoot.package_tier ? `${shoot.package_tier} · ${shoot.shoot_type}` : shoot.shoot_type}
                          </dd>
                        </div>
                      </dl>

                      {showStatus && (
                        <Badge variant="outline" className="w-fit text-[0.65rem]">
                          {STATUS_LABELS[shoot.status]}
                        </Badge>
                      )}

                      {shoot.status === "call_scheduled" && (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-7 w-full text-xs"
                          onClick={(e) => {
                            e.stopPropagation()
                            onGenerateVault(shoot)
                          }}
                        >
                          Generate Vault & Send Link
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}
