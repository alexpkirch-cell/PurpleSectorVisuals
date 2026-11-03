"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, PenLine } from "lucide-react"
import { toast } from "sonner"

import { countersignShoot } from "@/app/actions/shoots"
import { Button } from "@/components/ui/button"

export function CountersignRowButton({ shootId, clientName }: { shootId: string; clientName: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function handleClick() {
    setPending(true)
    try {
      const updated = await countersignShoot(shootId)
      toast.success(
        updated.status === "booked_paid"
          ? `Countersigned. ${clientName} is now Booked & Paid.`
          : `Countersigned ${clientName}. The card moves to Booked & Paid once the retainer is received.`
      )
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not countersign")
      setPending(false)
    }
  }

  return (
    <Button type="button" size="sm" onClick={handleClick} disabled={pending} aria-label={`Countersign ${clientName}'s agreement`}>
      {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <PenLine className="size-3.5" aria-hidden="true" />}
      {pending ? "Countersigning..." : "Countersign"}
    </Button>
  )
}
