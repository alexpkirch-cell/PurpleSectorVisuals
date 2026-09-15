"use client"

import { useState } from "react"
import { Plus, Trash2, X } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { createPackage, deletePackage, updatePackage } from "@/app/actions/packages"
import { PACKAGE_CATEGORIES, type AddOn, type PackageCategory, type ServicePackage } from "@/lib/packages"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
}

interface FormState {
  title: string
  category: PackageCategory
  basePrice: string
  duration: string
  deliverables: string[]
  addOns: AddOn[]
  isActive: boolean
}

const emptyForm: FormState = {
  title: "",
  category: "Portraits",
  basePrice: "",
  duration: "",
  deliverables: [""],
  addOns: [],
  isActive: true,
}

const MAX_ADD_ONS = 5

function createAddOnId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `addon-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function PackageManager({ initialPackages }: { initialPackages: ServicePackage[] }) {
  const [packages, setPackages] = useState(initialPackages)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)

  function openCreate(category?: PackageCategory) {
    setEditingId(null)
    setForm({ ...emptyForm, category: category ?? "Portraits" })
    setDialogOpen(true)
  }

  function openEdit(pkg: ServicePackage) {
    setEditingId(pkg.id)
    setForm({
      title: pkg.title,
      category: pkg.category,
      basePrice: String(pkg.base_price),
      duration: pkg.duration ?? "",
      deliverables: pkg.deliverables.length > 0 ? pkg.deliverables : [""],
      addOns: pkg.add_ons ?? [],
      isActive: pkg.is_active,
    })
    setDialogOpen(true)
  }

  async function handleDelete(id: string) {
    const previous = packages
    setPackages((current) => current.filter((p) => p.id !== id))
    try {
      await deletePackage(id)
      toast.success("Package deleted")
    } catch (error) {
      setPackages(previous)
      toast.error(error instanceof Error ? error.message : "Failed to delete package")
    }
  }

  async function handleSubmit() {
    const basePrice = Number(form.basePrice)
    if (!form.title.trim() || !Number.isFinite(basePrice) || basePrice < 0) {
      toast.error("Enter a valid title and base price.")
      return
    }

    setSaving(true)
    try {
      if (editingId) {
        const updated = await updatePackage(editingId, {
          title: form.title,
          category: form.category,
          basePrice,
          duration: form.duration,
          deliverables: form.deliverables,
          addOns: form.addOns,
          isActive: form.isActive,
        })
        setPackages((current) => current.map((p) => (p.id === editingId ? updated : p)))
        toast.success("Package updated")
      } else {
        const created = await createPackage({
          title: form.title,
          category: form.category,
          basePrice,
          duration: form.duration,
          deliverables: form.deliverables,
          addOns: form.addOns,
          isActive: form.isActive,
        })
        setPackages((current) => [...current, created])
        toast.success("Package created")
      }
      setDialogOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save package")
    } finally {
      setSaving(false)
    }
  }

  function updateDeliverable(index: number, value: string) {
    setForm((prev) => ({
      ...prev,
      deliverables: prev.deliverables.map((d, i) => (i === index ? value : d)),
    }))
  }

  function addDeliverable() {
    setForm((prev) => ({ ...prev, deliverables: [...prev.deliverables, ""] }))
  }

  function removeDeliverable(index: number) {
    setForm((prev) => ({ ...prev, deliverables: prev.deliverables.filter((_, i) => i !== index) }))
  }

  function addAddOn() {
    if (form.addOns.length >= MAX_ADD_ONS) {
      toast.error(`You can add up to ${MAX_ADD_ONS} add-ons per package.`)
      return
    }
    setForm((prev) => ({
      ...prev,
      addOns: [...prev.addOns, { id: createAddOnId(), name: "", price: 0 }],
    }))
  }

  function updateAddOnName(id: string, name: string) {
    setForm((prev) => ({
      ...prev,
      addOns: prev.addOns.map((addOn) => (addOn.id === id ? { ...addOn, name } : addOn)),
    }))
  }

  function updateAddOnPrice(id: string, price: string) {
    setForm((prev) => ({
      ...prev,
      addOns: prev.addOns.map((addOn) => (addOn.id === id ? { ...addOn, price: Number(price) || 0 } : addOn)),
    }))
  }

  function removeAddOn(id: string) {
    setForm((prev) => ({ ...prev, addOns: prev.addOns.filter((addOn) => addOn.id !== id) }))
  }

  const groupedPackages = PACKAGE_CATEGORIES.map((category) => ({
    category,
    packages: packages.filter((p) => p.category === category),
  }))

  return (
    <div className="flex flex-col gap-10">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {packages.length} package{packages.length === 1 ? "" : "s"} across {PACKAGE_CATEGORIES.length} categories
        </p>
        <Button onClick={() => openCreate()} className="gap-2">
          <Plus className="size-4" />
          New Package
        </Button>
      </div>

      {groupedPackages.map(({ category, packages: categoryPackages }) => (
        <div key={category} className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold text-foreground">{category}</h2>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openCreate(category)}>
              <Plus className="size-3.5" />
              Add to {category}
            </Button>
          </div>

          {categoryPackages.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              No packages in this category yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categoryPackages.map((pkg) => (
                <div key={pkg.id} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-heading text-base font-semibold text-foreground">{pkg.title}</h3>
                      <p className="mt-1 text-lg font-semibold text-foreground">
                        {formatCurrency(Number(pkg.base_price))}
                      </p>
                      {pkg.duration ? (
                        <p className="text-xs text-muted-foreground">{pkg.duration}</p>
                      ) : null}
                    </div>
                    <Badge variant={pkg.is_active ? "default" : "secondary"}>
                      {pkg.is_active ? "Active" : "Draft"}
                    </Badge>
                  </div>

                  {pkg.deliverables.length > 0 && (
                    <ul className="flex flex-col gap-1.5">
                      {pkg.deliverables.map((item, i) => (
                        <li key={i} className="text-sm leading-relaxed text-muted-foreground">
                          &bull; {item}
                        </li>
                      ))}
                    </ul>
                  )}

                  {pkg.add_ons.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {pkg.add_ons.map((addOn) => (
                        <Badge key={addOn.id} variant="outline" className="text-xs font-normal">
                          {addOn.name} · {formatCurrency(addOn.price)}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="mt-auto flex items-center gap-2 pt-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(pkg)}>
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(pkg.id)}
                      aria-label={`Delete ${pkg.title}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Package" : "New Package"}</DialogTitle>
            <DialogDescription>
              Active packages appear immediately in the public Studio Configurator.
            </DialogDescription>
          </DialogHeader>

          <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="pkg-title">Title</FieldLabel>
                <Input
                  id="pkg-title"
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="The Base Package"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="pkg-category">Category</FieldLabel>
                <Select
                  value={form.category}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, category: value as PackageCategory }))}
                >
                  <SelectTrigger id="pkg-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PACKAGE_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="pkg-price">Base Price (USD)</FieldLabel>
                <Input
                  id="pkg-price"
                  type="number"
                  min="0"
                  step="1"
                  value={form.basePrice}
                  onChange={(e) => setForm((prev) => ({ ...prev, basePrice: e.target.value }))}
                  placeholder="175"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="pkg-duration">Duration</FieldLabel>
                <Input
                  id="pkg-duration"
                  value={form.duration}
                  onChange={(e) => setForm((prev) => ({ ...prev, duration: e.target.value }))}
                  placeholder="Up to 60 minutes"
                />
              </Field>
            </div>

            <Field>
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="pkg-active">Active</FieldLabel>
                <Switch
                  id="pkg-active"
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked }))}
                />
              </div>
            </Field>

            <Field>
              <FieldLabel>Deliverables</FieldLabel>
              <div className="flex flex-col gap-2">
                {form.deliverables.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={item}
                      onChange={(e) => updateDeliverable(i, e.target.value)}
                      placeholder="15 retouched images"
                    />
                    <button
                      type="button"
                      onClick={() => removeDeliverable(i)}
                      aria-label="Remove deliverable"
                      className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" className="mt-1 w-fit gap-1.5" onClick={addDeliverable}>
                  <Plus className="size-3.5" />
                  Add deliverable
                </Button>
              </div>
            </Field>

            <Field>
              <div className="flex items-center justify-between">
                <FieldLabel>Add-Ons</FieldLabel>
                <span className="text-xs text-muted-foreground">
                  {form.addOns.length}/{MAX_ADD_ONS}
                </span>
              </div>
              <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
                {form.addOns.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No add-ons yet.</p>
                ) : (
                  form.addOns.map((addOn) => (
                    <div key={addOn.id} className="flex items-center gap-2">
                      <Input
                        value={addOn.name}
                        onChange={(e) => updateAddOnName(addOn.id, e.target.value)}
                        placeholder="Add-on name"
                        className="flex-1"
                      />
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <span>$</span>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={addOn.price}
                          onChange={(e) => updateAddOnPrice(addOn.id, e.target.value)}
                          className="h-9 w-20"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAddOn(addOn.id)}
                        aria-label="Remove add-on"
                        className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ))
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-1 w-fit gap-1.5"
                  onClick={addAddOn}
                  disabled={form.addOns.length >= MAX_ADD_ONS}
                >
                  <Plus className="size-3.5" />
                  Add add-on
                </Button>
              </div>
            </Field>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Saving…" : editingId ? "Save changes" : "Create package"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
