"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Plus } from "lucide-react"

import { createProject, SERVICE_TIERS, type ServiceTier } from "@/app/actions/command-center"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function NewProjectDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [serviceTier, setServiceTier] = useState<ServiceTier>("Portraits")

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    startTransition(async () => {
      const result = await createProject({
        clientName: String(data.get("name") ?? ""),
        clientEmail: String(data.get("email") ?? ""),
        clientPhone: String(data.get("phone") ?? ""),
        serviceTier,
        totalPrice: Number(data.get("price") ?? 0),
        vaultCode: String(data.get("vaultCode") ?? ""),
      })
      if (result.success) {
        toast.success("Project added to Leads.")
        setOpen(false)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus />
        New project
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Creates the client and a Lead. Enter a Vault PIN to link an existing vault so retainer and balance payments
            sync automatically.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-name">Client name</Label>
            <Input id="project-name" name="name" required />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-email">Email</Label>
              <Input id="project-email" name="email" type="email" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-phone">Phone</Label>
              <Input id="project-phone" name="phone" type="tel" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-tier">Service tier</Label>
              <select
                id="project-tier"
                value={serviceTier}
                onChange={(e) => setServiceTier(e.target.value as ServiceTier)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              >
                {SERVICE_TIERS.map((tier) => (
                  <option key={tier} value={tier}>
                    {tier}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-price">Total price (USD)</Label>
              <Input id="project-price" name="price" type="number" min="0" step="0.01" required />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-vault">Vault PIN (optional)</Label>
            <Input id="project-vault" name="vaultCode" inputMode="numeric" />
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="animate-spin" />}
            Create project
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
