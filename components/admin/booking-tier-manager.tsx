"use client"

import { useState } from "react"
import { Loader2, Plus, Trash2, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  createBookingAddon,
  deleteBookingAddon,
  updateBookingAddon,
  updateBookingTier,
  type BookingAddon,
  type BookingTier,
} from "@/app/actions/booking-config"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
}

function TierCard({ tier }: { tier: BookingTier }) {
  const [title, setTitle] = useState(tier.title)
  const [price, setPrice] = useState(String(tier.price))
  const [features, setFeatures] = useState<string[]>(tier.features.length ? tier.features : [""])
  const [slaTurnaround, setSlaTurnaround] = useState(tier.sla_turnaround ?? "")
  const [saving, setSaving] = useState(false)

  function updateFeature(index: number, value: string) {
    setFeatures((prev) => prev.map((f, i) => (i === index ? value : f)))
  }

  function addFeature() {
    setFeatures((prev) => [...prev, ""])
  }

  function removeFeature(index: number) {
    setFeatures((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await updateBookingTier(tier.id, {
        title,
        price: Number(price) || 0,
        features,
        slaTurnaround,
      })
      toast.success(`${tier.tier_key} package updated`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update package")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{tier.tier_key} tier</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">Price</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
          <Input type="number" min="0" step="1" value={price} onChange={(e) => setPrice(e.target.value)} className="pl-6" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">Features</Label>
        <div className="flex flex-col gap-2">
          {features.map((feature, index) => (
            <div key={index} className="flex items-center gap-1.5">
              <Input
                value={feature}
                onChange={(e) => updateFeature(index, e.target.value)}
                placeholder="e.g. 25 edited images"
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-8 shrink-0 text-muted-foreground"
                onClick={() => removeFeature(index)}
                aria-label="Remove feature"
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
        <Button type="button" size="sm" variant="outline" onClick={addFeature} className="mt-1 w-fit gap-1.5">
          <Plus className="size-3.5" />
          Add feature
        </Button>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">SLA turnaround time</Label>
        <Input
          value={slaTurnaround}
          onChange={(e) => setSlaTurnaround(e.target.value)}
          placeholder="e.g. 5-7 business days"
        />
      </div>

      <Button type="button" onClick={handleSave} disabled={saving} className="mt-1 gap-2">
        {saving ? <Loader2 className="size-4 animate-spin" /> : null}
        Save {tier.tier_key} package
      </Button>
    </div>
  )
}

function AddonRow({ addon, onDeleted }: { addon: BookingAddon; onDeleted: (id: string) => void }) {
  const [name, setName] = useState(addon.name)
  const [price, setPrice] = useState(String(addon.price))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await updateBookingAddon(addon.id, { name, price: Number(price) || 0 })
      toast.success("Add-on updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update add-on")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteBookingAddon(addon.id)
      onDeleted(addon.id)
      toast.success("Add-on removed")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete add-on")
      setDeleting(false)
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-card p-2.5">
      <Input value={name} onChange={(e) => setName(e.target.value)} className="flex-1" placeholder="Add-on name" />
      <div className="relative w-28 shrink-0">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
        <Input type="number" min="0" step="1" value={price} onChange={(e) => setPrice(e.target.value)} className="pl-6" />
      </div>
      <Button type="button" size="sm" variant="secondary" onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="size-3.5 animate-spin" /> : "Save"}
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-8 shrink-0 text-destructive"
        onClick={handleDelete}
        disabled={deleting}
        aria-label="Delete add-on"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  )
}

export function BookingTierManager({
  initialTiers,
  initialAddons,
}: {
  initialTiers: BookingTier[]
  initialAddons: BookingAddon[]
}) {
  const [addons, setAddons] = useState(initialAddons)
  const [creating, setCreating] = useState(false)

  async function handleCreateAddon() {
    setCreating(true)
    try {
      const addon = await createBookingAddon()
      setAddons((prev) => [...prev, addon])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create add-on")
    } finally {
      setCreating(false)
    }
  }

  function handleAddonDeleted(id: string) {
    setAddons((prev) => prev.filter((a) => a.id !== id))
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-heading text-lg font-medium text-foreground">Booking Pipeline Pricing</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Drives the package tiers and add-ons shown in the booking pipeline's Client Detail sheet. Changes apply
          globally — no code changes required.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {initialTiers.map((tier) => (
          <TierCard key={tier.id} tier={tier} />
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-foreground">Add-ons</span>
            <p className="text-xs text-muted-foreground">New add-ons default to {formatCurrency(25)}.</p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={handleCreateAddon} disabled={creating} className="gap-1.5">
            {creating ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            Add add-on
          </Button>
        </div>

        {addons.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
            No add-ons yet.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {addons.map((addon) => (
              <AddonRow key={addon.id} addon={addon} onDeleted={handleAddonDeleted} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
