"use client"

import { useState } from "react"
import { Camera, Loader2, Mail, Phone, Save, UserRound, Wallet } from "lucide-react"
import { toast } from "sonner"

import { updateClientCard } from "@/app/actions/crm"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })

export interface ClientCardValues {
  name: string
  email: string
  phone: string
  relationshipNotes: string
}

function Stat({ icon: Icon, label, value }: { icon: typeof Wallet; label: string; value: string }) {
  return (
    <div className="flex flex-1 flex-col gap-1 rounded-lg border border-border bg-background px-4 py-3">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </dt>
      <dd className="font-heading text-2xl font-medium text-foreground tabular-nums">{value}</dd>
    </div>
  )
}

/** The editable header of the Client Master Profile: contact details, lifetime numbers and relationship notes. */
export function ClientCard({
  clientKey,
  initial,
  lifetimeSpend,
  shootCount,
  onSaved,
}: {
  clientKey: string
  initial: ClientCardValues
  lifetimeSpend: number
  shootCount: number
  onSaved: (saved: { key: string; name: string; email: string; phone: string | null }) => void
}) {
  const [saved, setSaved] = useState(initial)
  const [values, setValues] = useState(initial)
  const [isSaving, setIsSaving] = useState(false)

  const dirty = (Object.keys(values) as (keyof ClientCardValues)[]).some((field) => values[field] !== saved[field])

  function update(field: keyof ClientCardValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      const result = await updateClientCard(clientKey, values)
      const next: ClientCardValues = {
        name: result.name,
        email: result.email,
        phone: result.phone ?? "",
        relationshipNotes: values.relationshipNotes.trim(),
      }
      setSaved(next)
      setValues(next)
      toast.success("Client card updated")
      onSaved(result)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the client card")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section aria-labelledby="client-card" className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-1">
        <p className="text-xs tracking-wider text-muted-foreground uppercase">Client Master Profile</p>
        <h1 id="client-card" className="font-heading text-2xl font-medium text-foreground">
          {saved.name}
        </h1>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="card-name">Full name</Label>
            <div className="relative">
              <UserRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input id="card-name" className="h-9 pl-9" value={values.name} onChange={(e) => update("name", e.target.value)} autoComplete="off" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="card-email">Email</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input id="card-email" type="email" className="h-9 pl-9" value={values.email} onChange={(e) => update("email", e.target.value)} autoComplete="off" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="card-phone">Phone</Label>
            <div className="relative">
              <Phone className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input id="card-phone" type="tel" className="h-9 pl-9" value={values.phone} onChange={(e) => update("phone", e.target.value)} placeholder="Not provided" autoComplete="off" />
            </div>
          </div>
        </div>

        <dl className="flex flex-col gap-3 sm:flex-row lg:flex-col">
          <Stat icon={Wallet} label="Lifetime spend" value={money.format(lifetimeSpend)} />
          <Stat icon={Camera} label="Total shoots" value={String(shootCount)} />
        </dl>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="card-notes">Relationship notes</Label>
        <Textarea
          id="card-notes"
          rows={4}
          value={values.relationshipNotes}
          onChange={(e) => update("relationshipNotes", e.target.value)}
          placeholder="Preferences, family details, how they found you, past conversations, things to remember..."
        />
        <p className="text-xs text-muted-foreground">Private to the studio. These notes follow the client across every shoot.</p>
      </div>

      <div className="flex items-center justify-end gap-3">
        {dirty ? <span className="text-xs text-muted-foreground">Unsaved changes</span> : null}
        <Button type="button" onClick={handleSave} disabled={!dirty || isSaving}>
          {isSaving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
          {isSaving ? "Saving..." : "Save client card"}
        </Button>
      </div>
    </section>
  )
}
