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
import {
  createPackage,
  deletePackage,
  updatePackage,
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
}

const emptyForm: FormState = { title: "", price: "", status: "draft", deliverables: [""] }

export function PackageManager({ initialPackages }: { initialPackages: ServicePackage[] }) {
  const [packages, setPackages] = useState(initialPackages)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(pkg: ServicePackage) {
    setEditingId(pkg.id)
    setForm({
      title: pkg.title,
      price: String(pkg.price),
      status: pkg.status,
      deliverables: pkg.deliverables.length > 0 ? pkg.deliverables : [""],
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
        })
        setPackages((current) => current.map((p) => (p.id === editingId ? updated : p)))
        toast.success("Package updated")
      } else {
        const created = await createPackage({
          title: form.title,
          price,
          status: form.status,
          deliverables: form.deliverables,
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
