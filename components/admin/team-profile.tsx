"use client"

import { useState } from "react"
import Image from "next/image"
import { Camera, Clock3, DollarSign, ImageUp, Plus, Trash2, TrendingUp } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface PerformanceStats {
  shootsCompleted: number
  totalRevenueGenerated: number
  avgTurnaroundDays: number
}

interface GearItem {
  id: string
  name: string
}

interface TeamProfileData {
  id: "alex" | "gabe"
  name: string
  title: string
  bio: string
  photo: string
  stats: PerformanceStats
  personalGear: GearItem[]
}

const INITIAL_PROFILES: TeamProfileData[] = [
  {
    id: "alex",
    name: "Alex",
    title: "Founder / Lead Sports Photographer",
    bio: "High-reach telephoto specialist chasing the decisive moment — AF-C burst tracking for sports, motorsport, and kinetic action across every discipline PSV shoots.",
    photo: "/images/alex-portrait.png",
    stats: { shootsCompleted: 47, totalRevenueGenerated: 18650, avgTurnaroundDays: 4.5 },
    personalGear: [
      { id: "a1", name: "Lumix G9 II" },
      { id: "a2", name: "Lumix 100-300mm f/4.0-5.6" },
      { id: "a3", name: "Lumix 12-60mm f/2.8-4.0" },
    ],
  },
  {
    id: "gabe",
    name: "Gabe",
    title: "Founder / Lead Portrait & Atmosphere Photographer",
    bio: "Wide-aperture storyteller working in low light — portraits, street, and paddock atmosphere rendered with tonal depth and a documentary eye.",
    photo: "/images/gabe-portrait.png",
    stats: { shootsCompleted: 39, totalRevenueGenerated: 15200, avgTurnaroundDays: 5.2 },
    personalGear: [
      { id: "g1", name: "Lumix G85" },
      { id: "g2", name: "Lumix 25mm f/1.7" },
      { id: "g3", name: "Lumix 42.5mm f/1.7" },
    ],
  },
]

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

function ProfileCard({ profile }: { profile: TeamProfileData }) {
  const [bio, setBio] = useState(profile.bio)
  const [name, setName] = useState(profile.name)
  const [title, setTitle] = useState(profile.title)
  const [gear, setGear] = useState<GearItem[]>(profile.personalGear)
  const [newGearName, setNewGearName] = useState("")

  function handleSave() {
    console.log("[v0] team profile saved", { id: profile.id, name, title, bio, gear })
  }

  function handlePhotoUpload() {
    console.log("[v0] team profile photo upload requested", { id: profile.id })
  }

  function addGear() {
    if (!newGearName.trim()) return
    const item: GearItem = { id: `${profile.id}-${Date.now()}`, name: newGearName.trim() }
    setGear((current) => [...current, item])
    console.log("[v0] personal gear added", { id: profile.id, item })
    setNewGearName("")
  }

  function removeGear(gearId: string) {
    setGear((current) => current.filter((item) => item.id !== gearId))
    console.log("[v0] personal gear removed", { id: profile.id, gearId })
  }

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-white/10 bg-black/40 p-5 backdrop-blur-md sm:p-6">
      <div className="flex items-center gap-4">
        <div className="group relative size-16 shrink-0 overflow-hidden rounded-full border border-white/10">
          <Image
            src={profile.photo || "/placeholder.svg"}
            alt={`Portrait of ${profile.name}`}
            fill
            sizes="64px"
            className="object-cover"
          />
          <button
            type="button"
            onClick={handlePhotoUpload}
            className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100"
            aria-label={`Update photo for ${profile.name}`}
          >
            <ImageUp className="size-4 text-zinc-100" />
          </button>
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
        <Label htmlFor={`bio-${profile.id}`} className="text-zinc-300">
          Public bio
        </Label>
        <Textarea
          id={`bio-${profile.id}`}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          className="border-white/10 bg-black/40 text-sm text-zinc-100"
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[0.65rem] uppercase tracking-wide text-zinc-500">Performance stats</span>
        <div className="grid grid-cols-3 gap-2">
          <StatCard icon={Camera} label="Shoots done" value={String(profile.stats.shootsCompleted)} />
          <StatCard
            icon={DollarSign}
            label="Revenue"
            value={formatCurrency(profile.stats.totalRevenueGenerated)}
          />
          <StatCard icon={Clock3} label="Avg turnaround" value={`${profile.stats.avgTurnaroundDays}d`} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[0.65rem] uppercase tracking-wide text-zinc-500">Personal gear</span>
        <ul className="flex flex-col gap-1.5">
          {gear.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300"
            >
              {item.name}
              <button
                type="button"
                onClick={() => removeGear(item.id)}
                aria-label={`Remove ${item.name}`}
                className="text-zinc-600 transition-colors hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Input
            value={newGearName}
            onChange={(e) => setNewGearName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                addGear()
              }
            }}
            placeholder="Add lens, body, or accessory..."
            className="border-white/10 bg-black/40 text-sm text-zinc-100 placeholder:text-zinc-600"
          />
          <Button type="button" variant="outline" onClick={addGear} className="border-white/10 bg-transparent">
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      <Button type="button" onClick={handleSave} className="bg-primary text-primary-foreground hover:bg-primary/90">
        Save profile
      </Button>
    </div>
  )
}

export function TeamProfile() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Team Profiles</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage public bios, photos, and personal gear for each team member.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {INITIAL_PROFILES.map((profile) => (
          <ProfileCard key={profile.id} profile={profile} />
        ))}
      </div>
    </div>
  )
}
