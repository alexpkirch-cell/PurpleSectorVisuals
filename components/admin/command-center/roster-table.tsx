"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, UserPlus } from "lucide-react"

import { createContractor, updateContractorW9, type Contractor, type SplitTier } from "@/app/actions/command-center"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const SPLIT_LABEL: Record<SplitTier, string> = {
  "50_50": "50 / 50",
  "70_30": "70 / 30",
}

function AddContractorForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [splitTier, setSplitTier] = useState<SplitTier>("50_50")

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    startTransition(async () => {
      const result = await createContractor({
        name: String(data.get("name") ?? ""),
        email: String(data.get("email") ?? ""),
        phone: String(data.get("phone") ?? ""),
        splitTier,
      })
      if (result.success) {
        toast.success("Contractor added.")
        form.reset()
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contractor-name">Name</Label>
        <Input id="contractor-name" name="name" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contractor-email">Email</Label>
        <Input id="contractor-email" name="email" type="email" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contractor-phone">Phone</Label>
        <Input id="contractor-phone" name="phone" type="tel" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contractor-split">Split tier</Label>
        <select
          id="contractor-split"
          value={splitTier}
          onChange={(e) => setSplitTier(e.target.value as SplitTier)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
        >
          <option value="50_50">50 / 50</option>
          <option value="70_30">70 / 30</option>
        </select>
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? <Loader2 className="animate-spin" /> : <UserPlus />}
        Add contractor
      </Button>
    </form>
  )
}

function W9Toggle({ contractor }: { contractor: Contractor }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const received = contractor.w9Status === "Received"

  function toggle() {
    startTransition(async () => {
      const result = await updateContractorW9(contractor.id, received ? "Pending" : "Received")
      if (!result.success) toast.error(result.error)
      router.refresh()
    })
  }

  return (
    <Button variant="ghost" size="sm" disabled={isPending} onClick={toggle} aria-label={`Toggle W-9 for ${contractor.name}`}>
      <Badge variant={received ? "default" : "outline"}>{contractor.w9Status}</Badge>
    </Button>
  )
}

export function RosterTable({ contractors }: { contractors: Contractor[] }) {
  return (
    <div className="flex flex-col gap-4">
      <AddContractorForm />
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th scope="col" className="px-4 py-2 font-medium">
                Contractor
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                Contact
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                Split tier
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                W-9
              </th>
            </tr>
          </thead>
          <tbody>
            {contractors.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No contractors yet. Add your first roster member above.
                </td>
              </tr>
            ) : (
              contractors.map((contractor) => (
                <tr key={contractor.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium text-foreground">{contractor.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {[contractor.email, contractor.phone].filter(Boolean).join(" · ") || "No contact on file"}
                  </td>
                  <td className="px-4 py-3 text-foreground">{SPLIT_LABEL[contractor.splitTier]}</td>
                  <td className="px-4 py-3">
                    <W9Toggle contractor={contractor} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
