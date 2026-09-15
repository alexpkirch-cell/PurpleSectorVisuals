"use client"

import { useId, useState } from "react"
import { Plus, Trash2, X } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  createPackage,
  deletePackage,
  updatePackage,
  type AddOn,
  type PackageStatus,
  type ServicePackage,
} from "@/app/actions/packages"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
}

interface FormState {
  title: string
  price: string
  status: PackageStatus
  deliverables: string[]
  addOns: AddOn[]
}

const emptyForm: FormState = { title: "", price: "", status: "draft", deliverables: [""], addOns: [] }

const QUICK_ADD_ADDONS: { name: string; price: number }[] = [
  { name: "Rush 24hr Delivery", price: 50 },
  { name: "Extra Location", price: 25 },
  { name: "Highlight Reel", price: 75 },
]

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
  const [customAddOnName, setCustomAddOnName] = useState("")
  const [customAddOnPrice, setCustomAddOnPrice] = useState("")

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setCustomAddOnName("")
    setCustomAddOnPrice("")
    setDialogOpen(true)
  }

  function openEdit(pkg: ServicePackage) {
    setEditingId(pkg.id)
    setForm({
      title: pkg.title,
      price: String(pkg.price),
      status: pkg.status,
      deliverables: pkg.deliverables.length > 0 ? pkg.deliverables : [""],
      addOns: pkg.available_addons ?? [],
    })
    setCustomAddOnName("")
    setCustomAddOnPrice("")
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
    const price = Number(form.price)
    if (!form.title.trim() || !Number.isFinite(price) || price < 0) {
      toast.error("Enter a valid title and price.")
      return
    }

    setSaving(true)
    try {
      if (editingId) {
        const updated = await updatePackage(editingId, {
          title: form.title,
          price,
          status: form.status,
          deliverables: form.deliverables,
          availableAddons: form.addOns,
        })
        setPackages((current) => current.map((p) => (p.id === editingId ? updated : p)))
        toast.success("Package updated")
      } else {
        const created = await createPackage({
          title: form.title,
          price,
          status: form.status,
          deliverables: form.deliverables,
          availableAddons: form.addOns,
        })
        setPackages((current) => [created, ...current])
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

  function isQuickAddChecked(name: string) {
    return form.addOns.some((addOn) => addOn.isQuickAdd && addOn.name === name)
  }

  function toggleQuickAddOn(quickAddOn: { name: string; price: number }, checked: boolean) {
    setForm((prev) => {
      if (checked) {
        return {
          ...prev,
          addOns: [
            ...prev.addOns,
            { id: createAddOnId(), name: quickAddOn.name, price: quickAddOn.price, isQuickAdd: true },
          ],
        }
      }
      return {
        ...prev,
        addOns: prev.addOns.filter((addOn) => !(addOn.isQuickAdd && addOn.name === quickAddOn.name)),
      }
    })
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

  function addCustomAddOn() {
    const price = Number(customAddOnPrice)
    if (!customAddOnName.trim() || !Number.isFinite(price) || price < 0) {
      toast.error("Enter a valid add-on name and price.")
      return
    }
    setForm((prev) => ({
      ...prev,
      addOns: [...prev.addOns, { id: createAddOnId(), name: customAddOnName.trim(), price, isQuickAdd: false }],
    }))
    setCustomAddOnName("")
    setCustomAddOnPrice("")
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{packages.length} package{packages.length === 1 ? "" : "s"}</p>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="size-4" />
          New Package
        </Button>
      </div>

      {packages.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          No packages yet. Create one to make it available on the public Packages page.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg) => (
            <div key={pkg.id} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-heading text-base font-semibold text-foreground">{pkg.title}</h3>
                  <p className="mt-1 text-lg font-semibold text-foreground">{formatCurrency(Number(pkg.price))}</p>
                </div>
                <Badge variant={pkg.status === "active" ? "default" : "secondary"} className="capitalize">
                  {pkg.status}
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

              {pkg.available_addons.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {pkg.available_addons.map((addOn) => (
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Package" : "New Package"}</DialogTitle>
            <DialogDescription>
              Packages marked Active appear on the public Packages page immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="pkg-title">Title</FieldLabel>
              <Input
                id="pkg-title"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Automotive Feature"
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="pkg-price">Price (USD)</FieldLabel>
                <Input
                  id="pkg-price"
                  type="number"
                  min="0"
                  step="1"
                  value={form.price}
                  onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
                  placeholder="225"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="pkg-status">Status</FieldLabel>
                <Select
                  value={form.status}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, status: value as PackageStatus }))}
                >
                  <SelectTrigger id="pkg-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field>
              <FieldLabel>Deliverables</FieldLabel>
              <div className="flex flex-col gap-2">
                {form.deliverables.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={item}
                      onChange={(e) => updateDeliverable(i, e.target.value)}
                      placeholder="12-15 signature retouched hero images"
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
              <FieldLabel>Add-Ons</FieldLabel>
              <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
                <div className="flex flex-col gap-2">
                  {QUICK_ADD_ADDONS.map((quickAddOn) => (
                    <div key={quickAddOn.name} className="flex items-center gap-2.5">
                      <Checkbox
                        id={`quick-add-${quickAddOn.name}`}
                        checked={isQuickAddChecked(quickAddOn.name)}
                        onCheckedChange={(checked) => toggleQuickAddOn(quickAddOn, checked === true)}
                      />
                      <Label
                        htmlFor={`quick-add-${quickAddOn.name}`}
                        className="cursor-pointer text-sm font-normal text-foreground"
                      >
                        {quickAddOn.name} (+{formatCurrency(quickAddOn.price)})
                      </Label>
                    </div>
                  ))}
                </div>

                {form.addOns.length > 0 && (
                  <div className="flex flex-col gap-2 border-t border-border pt-3">
                    {form.addOns.map((addOn) => (
                      <div key={addOn.id} className="flex items-center gap-2">
                        <span className="flex-1 truncate text-sm text-foreground">
                          {addOn.name}
                          {addOn.isQuickAdd ? (
                            <span className="ml-1.5 text-xs text-muted-foreground">Quick-add</span>
                          ) : null}
                        </span>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <span>$</span>
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={addOn.price}
                            onChange={(e) => updateAddOnPrice(addOn.id, e.target.value)}
                            className="h-8 w-20"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAddOn(addOn.id)}
                          aria-label={`Remove ${addOn.name}`}
                          className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 border-t border-border pt-3">
                  <Input
                    value={customAddOnName}
                    onChange={(e) => setCustomAddOnName(e.target.value)}
                    placeholder="Custom add-on name"
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={customAddOnPrice}
                    onChange={(e) => setCustomAddOnPrice(e.target.value)}
                    placeholder="Price"
                    className="w-24"
                  />
                  <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={addCustomAddOn}>
                    <Plus className="size-3.5" />
                    Add
                  </Button>
                </div>
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
