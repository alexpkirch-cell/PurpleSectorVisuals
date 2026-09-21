"use client"

import { useRef, useState, useTransition } from "react"
import Image from "next/image"
import { Camera, Clock3, DollarSign, ImageUp, Plus, Trash2, TrendingUp } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  assignGearToMember,
  updateTeamMember,
  uploadTeamPhoto,
  type TeamMemberWithStats,
} from "@/app/actions/team"
import type { GearItem } from "@/app/actions/gear"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    value,
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof TrendingUp
  label: string
  value: string
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-white/10 bg-black/40 p-4 backdrop-blur-md">
      <div className="flex items-center gap-2 text-zinc-500">
        <Icon className="size-3.5" />
        <span className="text-[0.65rem] uppercase tracking-wide">{label}</span>
      </div>
      <span className="font-heading text-xl font-bold text-zinc-50">{value}</span>
    </div>
  )
}

function ProfileCard({
  member,
  unassignedGear,
  onGearAssigned,
}: {
  member: TeamMemberWithStats
  unassignedGear: GearItem[]
  onGearAssigned: (gearId: string, memberId: string) => void
}) {
  const [name, setName] = useState(member.name)
  const [title, setTitle] = useState(member.title)
  const [bio, setBio] = useState(member.bio)
  const [photoUrl, setPhotoUrl] = useState(member.photo_url)
  const [gear, setGear] = useState<GearItem[]>(member.gear)
  const [selectedGearId, setSelectedGearId] = useState<string>("")
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleSave() {
    startTransition(async () => {
      await updateTeamMember(member.id, { name, title, bio, photoUrl })
    })
  }

  function handlePhotoUpload() {
    fileInputRef.current?.click()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const previewUrl = URL.createObjectURL(file)
    setPhotoUrl(previewUrl)

    const formData = new FormData()
    formData.set("file", file)

    startTransition(async () => {
      const publicUrl = await uploadTeamPhoto(member.id, formData)
      setPhotoUrl(publicUrl)
    })

    e.target.value = ""
  }

  function addGear() {
    if (!selectedGearId) return
    const item = unassignedGear.find((g) => g.id === selectedGearId)
    if (!item) return

    setGear((current) => [{ ...item, team_member_id: member.id }, ...current])
    onGearAssigned(item.id, member.id)
    setSelectedGearId("")

    startTransition(async () => {
      await assignGearToMember(item.id, member.id)
    })
  }

  function removeGear(gearId: string) {
    setGear((current) => current.filter((item) => item.id !== gearId))
    startTransition(async () => {
      await assignGearToMember(gearId, null)
    })
  }

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-white/10 bg-black/40 p-5 backdrop-blur-md sm:p-6">
      <div className="flex items-center gap-4">
        <div className="group relative size-16 shrink-0 overflow-hidden rounded-full border border-white/10">
          <Image
            src={photoUrl || "/placeholder.svg"}
            alt={`Portrait of ${member.name}`}
            fill
            sizes="64px"
            className="object-cover"
          />
          <button
            type="button"
            onClick={handlePhotoUpload}
            className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100"
            aria-label={`Update photo for ${member.name}`}
          >
            <ImageUp className="size-4 text-zinc-100" />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={handleFileChange} />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 border-white/10 bg-black/40 font-heading text-lg font-bold text-zinc-50"
          />
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-7 border-white/10 bg-black/40 text-xs text-primary"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`bio-${member.id}`} className="text-zinc-300">
          Public bio
        </Label>
        <Textarea
          id={`bio-${member.id}`}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          className="border-white/10 bg-black/40 text-sm text-zinc-100"
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[0.65rem] uppercase tracking-wide text-zinc-500">Performance stats</span>
        <div className="grid grid-cols-3 gap-2">
          <StatCard icon={Camera} label="Shoots done" value={String(member.stats.shootsCompleted)} />
          <StatCard icon={DollarSign} label="Revenue" value={formatCurrency(member.stats.revenueGenerated)} />
          <StatCard
            icon={Clock3}
            label="Avg turnaround"
            value={member.stats.avgTurnaroundDays !== null ? `${member.stats.avgTurnaroundDays}d` : "\u2014"}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[0.65rem] uppercase tracking-wide text-zinc-500">Personal gear</span>
        {gear.length === 0 ? (
          <p className="text-sm text-zinc-500">No personal gear assigned yet.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {gear.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300"
              >
                {item.item_name}
                <button
                  type="button"
                  onClick={() => removeGear(item.id)}
                  aria-label={`Remove ${item.item_name}`}
                  className="text-zinc-600 transition-colors hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <Select value={selectedGearId} onValueChange={(value) => setSelectedGearId(value ?? "")}>
            <SelectTrigger className="border-white/10 bg-black/40 text-sm text-zinc-100">
              <SelectValue placeholder="Assign unassigned gear..." />
            </SelectTrigger>
            <SelectContent>
              {unassignedGear.length === 0 ? (
                <div className="px-3 py-2 text-sm text-zinc-500">No unassigned gear available</div>
              ) : (
                unassignedGear.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.item_name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            onClick={addGear}
            disabled={!selectedGearId}
            className="border-white/10 bg-transparent"
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      <Button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="bg-primary text-primary-foreground hover:bg-primary/90"
      >
        Save profile
      </Button>
    </div>
  )
}

export function TeamProfile({
  members,
  unassignedGear,
}: {
  members: TeamMemberWithStats[]
  unassignedGear: GearItem[]
}) {
  const [available, setAvailable] = useState<GearItem[]>(unassignedGear)

  function handleGearAssigned(gearId: string) {
    setAvailable((current) => current.filter((item) => item.id !== gearId))
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Team Profiles</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage public bios, photos, and personal gear for each team member.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {members.map((member) => (
          <ProfileCard
            key={member.id}
            member={member}
            unassignedGear={available}
            onGearAssigned={handleGearAssigned}
          />
        ))}
      </div>
    </div>
  )
}
