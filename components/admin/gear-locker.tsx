"use client"

import { useState } from "react"
import { Aperture, Battery, Lightbulb, Package, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type GearCategory = "Lenses" | "Lighting" | "SD Cards" | "Bodies" | "Other"

interface BusinessGearItem {
  id: string
  itemName: string
  category: GearCategory
  serialNumber: string
  purchaseDate: string
  checkedOutBy: string | null
}

const CHECKOUT_ROSTER = ["Alex", "Gabe", "Jordan", "Maya", "Priya", "Sam"]

const CATEGORY_ICON: Record<GearCategory, typeof Aperture> = {
  Lenses: Aperture,
  Lighting: Lightbulb,
  "SD Cards": Battery,
  Bodies: Package,
  Other: Package,
}

const INITIAL_GEAR: BusinessGearItem[] = [
  {
    id: "bg1",
    itemName: "Sony 70-200mm f/2.8 GM II",
    category: "Lenses",
    serialNumber: "SN-7020028-114",
    purchaseDate: "2024-03-12",
    checkedOutBy: "Alex",
  },
  {
    id: "bg2",
    itemName: "Godox AD200Pro Flash",
    category: "Lighting",
    serialNumber: "GDX-AD200-0092",
    purchaseDate: "2023-11-02",
    checkedOutBy: null,
  },
  {
    id: "bg3",
    itemName: "SanDisk 128GB Extreme Pro (x4)",
    category: "SD Cards",
    serialNumber: "SDXP-128-SET04",
    purchaseDate: "2024-06-20",
    checkedOutBy: "Gabe",
  },
  {
    id: "bg4",
    itemName: "Sony A7 IV Body (Backup)",
    category: "Bodies",
    serialNumber: "SNY-A7IV-88231",
    purchaseDate: "2023-08-15",
    checkedOutBy: null,
  },
  {
    id: "bg5",
    itemName: "Neewer 5-in-1 Reflector",
    category: "Lighting",
    serialNumber: "NWR-R5-2201",
    purchaseDate: "2022-05-09",
    checkedOutBy: null,
  },
]

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function GearCard({
  item,
  onCheckedOutByChange,
  onDelete,
}: {
  item: BusinessGearItem
  onCheckedOutByChange: (id: string, name: string | null) => void
  onDelete: (id: string) => void
}) {
  const Icon = CATEGORY_ICON[item.category]

  return (
    <div className="group relative flex flex-col gap-4 rounded-xl border border-white/10 bg-black/40 p-5 backdrop-blur-md transition-colors hover:border-primary/40">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
            <Icon className="size-4 text-primary" strokeWidth={1.5} />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium leading-tight text-zinc-100">{item.itemName}</span>
            <span className="text-[0.65rem] uppercase tracking-wide text-zinc-500">{item.category}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onDelete(item.id)}
          aria-label={`Remove ${item.itemName}`}
          className="text-zinc-600 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="flex flex-col gap-0.5">
          <span className="text-[0.65rem] uppercase tracking-wide text-zinc-500">Serial number</span>
          <span className="text-zinc-300">{item.serialNumber}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[0.65rem] uppercase tracking-wide text-zinc-500">Purchase date</span>
          <span className="text-zinc-300">{formatDate(item.purchaseDate)}</span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-[0.65rem] uppercase tracking-wide text-zinc-500">Checked out by</Label>
        <Select
          value={item.checkedOutBy ?? "none"}
          onValueChange={(value) => onCheckedOutByChange(item.id, value === "none" ? null : value)}
        >
          <SelectTrigger size="sm" className="border-white/10 bg-black/40 text-zinc-100">
            <SelectValue>{item.checkedOutBy ?? "In the locker"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">In the locker</SelectItem>
            {CHECKOUT_ROSTER.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

export function GearLocker() {
  const [gear, setGear] = useState<BusinessGearItem[]>(INITIAL_GEAR)
  const [isAdding, setIsAdding] = useState(false)
  const [draft, setDraft] = useState({ itemName: "", category: "Other" as GearCategory, serialNumber: "", purchaseDate: "" })

  function handleCheckedOutByChange(id: string, name: string | null) {
    setGear((current) => current.map((item) => (item.id === id ? { ...item, checkedOutBy: name } : item)))
    console.log("[v0] gear checkout updated", { id, checkedOutBy: name })
  }

  function handleDelete(id: string) {
    setGear((current) => current.filter((item) => item.id !== id))
    console.log("[v0] gear item removed", { id })
  }

  function handleAddItem() {
    if (!draft.itemName.trim() || !draft.serialNumber.trim() || !draft.purchaseDate) return
    const item: BusinessGearItem = {
      id: `bg-${Date.now()}`,
      itemName: draft.itemName.trim(),
      category: draft.category,
      serialNumber: draft.serialNumber.trim(),
      purchaseDate: draft.purchaseDate,
      checkedOutBy: null,
    }
    setGear((current) => [item, ...current])
    console.log("[v0] gear item added", item)
    setDraft({ itemName: "", category: "Other", serialNumber: "", purchaseDate: "" })
    setIsAdding(false)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Business Asset Manager</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track studio-owned lenses, lighting, cards, and bodies across the team.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setIsAdding((current) => !current)}
          className="border-white/10 bg-transparent"
        >
          <Plus className="size-4" />
          Add asset
        </Button>
      </div>

      {isAdding && (
        <div className="grid grid-cols-1 gap-3 rounded-xl border border-white/10 bg-black/40 p-5 backdrop-blur-md sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-zinc-300">Item name</Label>
            <Input
              value={draft.itemName}
              onChange={(e) => setDraft((d) => ({ ...d, itemName: e.target.value }))}
              placeholder="e.g. Profoto B10 Plus"
              className="border-white/10 bg-black/40 text-zinc-100 placeholder:text-zinc-600"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-zinc-300">Category</Label>
            <Select
              value={draft.category}
              onValueChange={(value) => setDraft((d) => ({ ...d, category: value as GearCategory }))}
            >
              <SelectTrigger className="border-white/10 bg-black/40 text-zinc-100">
                <SelectValue>{draft.category}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CATEGORY_ICON) as GearCategory[]).map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-zinc-300">Serial number</Label>
            <Input
              value={draft.serialNumber}
              onChange={(e) => setDraft((d) => ({ ...d, serialNumber: e.target.value }))}
              placeholder="SN-000000"
              className="border-white/10 bg-black/40 text-zinc-100 placeholder:text-zinc-600"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-zinc-300">Purchase date</Label>
            <Input
              type="date"
              value={draft.purchaseDate}
              onChange={(e) => setDraft((d) => ({ ...d, purchaseDate: e.target.value }))}
              className="border-white/10 bg-black/40 text-zinc-100"
            />
          </div>
          <div className="col-span-full flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setIsAdding(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleAddItem} className="bg-primary text-primary-foreground hover:bg-primary/90">
              Save asset
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {gear.map((item) => (
          <GearCard key={item.id} item={item} onCheckedOutByChange={handleCheckedOutByChange} onDelete={handleDelete} />
        ))}
      </div>
    </div>
  )
}
