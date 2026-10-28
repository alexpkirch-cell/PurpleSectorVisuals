"use client"

import { useState, type FormEvent } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createManualBooking, type Shoot } from "@/app/actions/shoots"

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"

export function ManualBookingDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (shoot: Shoot) => void
}) {
  const [isSaving, setIsSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const text = (key: string) => String(data.get(key) ?? "")
    const tier = text("packageTier")

    setIsSaving(true)
    try {
      const shoot = await createManualBooking({
        clientName: text("clientName"),
        clientEmail: text("clientEmail"),
        clientPhone: text("clientPhone"),
        shootType: text("shootType"),
        packageTier: tier === "Base" || tier === "Standard" ? tier : undefined,
        shootDate: text("shootDate") || undefined,
        location: text("location"),
        leadShooter: text("leadShooter"),
        notes: text("notes"),
      })
      onCreated(shoot)
      form.reset()
      onOpenChange(false)
      toast.success(`${shoot.client_name} added to New Inquiry`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create booking")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Manual Booking</DialogTitle>
          <DialogDescription>
            Add a lead that came in outside the website. It lands in New Inquiry so you can quote it.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mb-client-name">Client name</Label>
              <Input id="mb-client-name" name="clientName" required autoComplete="off" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mb-client-email">Email</Label>
              <Input id="mb-client-email" name="clientEmail" type="email" required autoComplete="off" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mb-client-phone">Phone</Label>
              <Input id="mb-client-phone" name="clientPhone" type="tel" autoComplete="off" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mb-shoot-type">Shoot type</Label>
              <Input id="mb-shoot-type" name="shootType" required placeholder="Car meet, portrait session..." />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mb-package">Package</Label>
              <select id="mb-package" name="packageTier" defaultValue="" className={selectClass}>
                <option value="">Decide later</option>
                <option value="Base">Base</option>
                <option value="Standard">Standard</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mb-lead-shooter">Lead shooter</Label>
              <select id="mb-lead-shooter" name="leadShooter" defaultValue="" className={selectClass}>
                <option value="">Unassigned</option>
                <option value="Alex">Alex</option>
                <option value="Gabe">Gabe</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mb-shoot-date">Shoot date</Label>
              <Input id="mb-shoot-date" name="shootDate" type="date" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mb-location">Location</Label>
              <Input id="mb-location" name="location" autoComplete="off" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mb-notes">Notes</Label>
            <Textarea id="mb-notes" name="notes" rows={3} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Adding..." : "Add booking"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
