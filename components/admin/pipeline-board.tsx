"use client"

import { useState } from "react"
import { Mail, Phone, X } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import {
  deleteBookingRequest,
  updatePipelineStage,
  type PipelineStatus,
} from "@/app/actions/admin-pipeline"

export type BookingCard = {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  subject: string
  creator: string
  package: string
  status: PipelineStatus
  created_at: string
}

const COLUMNS: { status: PipelineStatus; label: string }[] = [
  { status: "new_inquiry", label: "New Inquiry" },
  { status: "contacted", label: "Contacted" },
  { status: "shoot_scheduled", label: "Shoot Scheduled" },
  { status: "editing", label: "Editing" },
  { status: "vault_created", label: "Vault Created" },
]

function relativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  if (diffHours < 1) return "just now"
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

export function PipelineBoard({ initialCards }: { initialCards: BookingCard[] }) {
  const [cards, setCards] = useState(initialCards)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverStatus, setDragOverStatus] = useState<PipelineStatus | null>(null)

  async function moveCard(id: string, status: PipelineStatus) {
    const previous = cards
    setCards((current) => current.map((c) => (c.id === id ? { ...c, status } : c)))
    try {
      await updatePipelineStage(id, status)
    } catch (error) {
      setCards(previous)
      toast.error(error instanceof Error ? error.message : "Failed to move card")
    }
  }

  async function dismissCard(id: string) {
    const previous = cards
    setCards((current) => current.filter((c) => c.id !== id))
    try {
      await deleteBookingRequest(id)
      toast.success("Inquiry dismissed")
    } catch (error) {
      setCards(previous)
      toast.error(error instanceof Error ? error.message : "Failed to dismiss inquiry")
    }
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
      {COLUMNS.map((column) => {
        const columnCards = cards.filter((c) => c.status === column.status)
        const isDragOver = dragOverStatus === column.status
        return (
          <div
            key={column.status}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOverStatus(column.status)
            }}
            onDragLeave={() => setDragOverStatus((current) => (current === column.status ? null : current))}
            onDrop={(e) => {
              e.preventDefault()
              setDragOverStatus(null)
              if (draggingId) {
                moveCard(draggingId, column.status)
                setDraggingId(null)
              }
            }}
            className={
              "flex min-h-40 flex-col gap-2 rounded-lg border p-2.5 transition-colors " +
              (isDragOver ? "border-primary bg-primary/5" : "border-border bg-accent/20")
            }
          >
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-semibold tracking-wide text-foreground">{column.label}</h3>
              <span className="text-xs text-muted-foreground">{columnCards.length}</span>
            </div>

            {columnCards.length === 0 ? (
              <p className="px-1 py-4 text-center text-xs text-muted-foreground">No cards</p>
            ) : (
              <div className="flex flex-col gap-2">
                {columnCards.map((card) => (
                  <div
                    key={card.id}
                    draggable
                    onDragStart={() => setDraggingId(card.id)}
                    onDragEnd={() => setDraggingId(null)}
                    className={
                      "group flex cursor-grab flex-col gap-1.5 rounded-md border border-border bg-card p-2.5 shadow-sm active:cursor-grabbing " +
                      (draggingId === card.id ? "opacity-50" : "")
                    }
                  >
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-sm font-medium text-foreground">
                        {card.first_name} {card.last_name}
                      </p>
                      <button
                        type="button"
                        onClick={() => dismissCard(card.id)}
                        aria-label={`Dismiss ${card.first_name} ${card.last_name}`}
                        className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      <Badge variant="secondary" className="text-[0.6rem]">
                        {card.subject}
                      </Badge>
                      <Badge variant="secondary" className="text-[0.6rem]">
                        {card.creator}
                      </Badge>
                      <Badge variant="secondary" className="text-[0.6rem]">
                        {card.package}
                      </Badge>
                    </div>

                    <div className="flex flex-col gap-0.5 text-[0.7rem] text-muted-foreground">
                      <span className="flex items-center gap-1 truncate">
                        <Mail className="size-3 shrink-0" />
                        {card.email}
                      </span>
                      <span className="flex items-center gap-1 truncate">
                        <Phone className="size-3 shrink-0" />
                        {card.phone}
                      </span>
                    </div>

                    <span className="text-[0.65rem] text-muted-foreground">
                      {relativeTime(card.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
