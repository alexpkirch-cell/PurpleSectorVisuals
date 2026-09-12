"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Usb } from "lucide-react"

import { updateUsbStatus, type UsbStatus } from "@/app/actions/admin-galleries"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const STATUS_LABELS: Record<UsbStatus, string> = {
  pending: "Pending",
  mailed: "Mailed",
  hand_delivered: "Hand-Delivered",
}

export function UsbStatusSelect({
  galleryId,
  status,
}: {
  galleryId: string
  status: UsbStatus
}) {
  const router = useRouter()
  const [value, setValue] = useState<UsbStatus>(status)
  const [isPending, startTransition] = useTransition()

  function handleChange(next: string | null) {
    if (!next) return
    const nextStatus = next as UsbStatus
    setValue(nextStatus)
    startTransition(async () => {
      await updateUsbStatus(galleryId, nextStatus)
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
      <Usb className="size-4 shrink-0 text-muted-foreground" />
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">USB Delivery</span>
        <Select value={value} onValueChange={handleChange} disabled={isPending}>
          <SelectTrigger size="sm" className="w-40">
            <SelectValue>{STATUS_LABELS[value]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="mailed">Mailed</SelectItem>
            <SelectItem value="hand_delivered">Hand-Delivered</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
