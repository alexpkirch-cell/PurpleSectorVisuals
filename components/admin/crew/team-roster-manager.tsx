"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { ExternalLink, Pencil, Plus, Trash2, User } from "lucide-react"
import { toast } from "sonner"

import { deleteDirectoryMember, setDirectoryMemberActive } from "@/app/actions/team-directory"
import { TeamMemberSheet } from "@/components/admin/crew/team-member-sheet"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import type { DirectoryMember } from "@/lib/team-directory"

export function TeamRosterManager({ initialMembers }: { initialMembers: DirectoryMember[] }) {
  const [members, setMembers] = useState(initialMembers)
  const [editing, setEditing] = useState<DirectoryMember | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<DirectoryMember | null>(null)
  const [, startTransition] = useTransition()

  function openNew() {
    setEditing(null)
    setSheetOpen(true)
  }

  function openEdit(member: DirectoryMember) {
    setEditing(member)
    setSheetOpen(true)
  }

  function handleSaved(saved: DirectoryMember) {
    setMembers((list) =>
      list.some((m) => m.id === saved.id) ? list.map((m) => (m.id === saved.id ? saved : m)) : [...list, saved]
    )
  }

  function toggleActive(member: DirectoryMember, isActive: boolean) {
    setMembers((list) => list.map((m) => (m.id === member.id ? { ...m, is_active: isActive } : m)))
    startTransition(async () => {
      try {
        await setDirectoryMemberActive(member.id, isActive)
        toast.success(`${member.name} is now ${isActive ? "visible" : "hidden"} on /team`)
      } catch (error) {
        setMembers((list) => list.map((m) => (m.id === member.id ? { ...m, is_active: !isActive } : m)))
        toast.error(error instanceof Error ? error.message : "Could not update visibility")
      }
    })
  }

  function confirmDelete() {
    const target = pendingDelete
    if (!target) return
    setPendingDelete(null)
    startTransition(async () => {
      try {
        await deleteDirectoryMember(target.id)
        setMembers((list) => list.filter((m) => m.id !== target.id))
        toast.success(`${target.name} removed from the roster`)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not delete team member")
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted-foreground">
          People shown on the public{" "}
          <Link href="/team" className="underline underline-offset-4 hover:text-foreground">
            Team page
          </Link>
          . Each profile gets its own page with their highlight media.
        </p>
        <Button onClick={openNew}>
          <Plus className="size-4" />
          Add team member
        </Button>
      </div>

      {members.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No team members yet. Add the first one to publish the Team page.
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {members.map((member) => (
            <li key={member.id} className="flex flex-wrap items-center gap-4 p-4">
              <div className="flex size-14 shrink-0 items-end justify-center overflow-hidden rounded-md bg-muted text-muted-foreground">
                {member.cutout_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={member.cutout_image_url} alt="" className="size-full object-contain object-bottom" />
                ) : (
                  <User className="mb-3 size-6 self-center" aria-hidden="true" />
                )}
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-foreground">{member.name}</span>
                  <Link
                    href={`/team/${member.slug}`}
                    className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground"
                  >
                    /team/{member.slug}
                    <ExternalLink className="size-3" aria-hidden="true" />
                  </Link>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {member.roles.map((role) => (
                    <Badge key={`r-${role}`}>{role}</Badge>
                  ))}
                  {member.specialties.map((specialty) => (
                    <Badge key={`s-${specialty}`} variant="outline">
                      {specialty}
                    </Badge>
                  ))}
                  <span className="text-xs text-muted-foreground">
                    {member.highlight_media.length} highlight{member.highlight_media.length === 1 ? "" : "s"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch
                    size="sm"
                    checked={member.is_active}
                    onCheckedChange={(checked) => toggleActive(member, checked)}
                    aria-label={`Show ${member.name} on the Team page`}
                  />
                  {member.is_active ? "Visible" : "Hidden"}
                </label>
                <Button variant="outline" size="icon" onClick={() => openEdit(member)} aria-label={`Edit ${member.name}`}>
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPendingDelete(member)}
                  aria-label={`Delete ${member.name}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <TeamMemberSheet member={editing} open={sheetOpen} onOpenChange={setSheetOpen} onSaved={handleSaved} />

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pendingDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the profile and its page permanently. To hide someone temporarily, switch them to hidden instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
