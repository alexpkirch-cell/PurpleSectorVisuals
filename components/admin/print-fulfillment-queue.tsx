"use client"

import { useState, useTransition } from "react"
import { ImageIcon, Printer } from "lucide-react"
import { toast } from "sonner"

import { markPrintOrderFulfilled, type PendingPrintOrder } from "@/app/actions/print-orders"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export function PrintFulfillmentQueue({ initialOrders }: { initialOrders: PendingPrintOrder[] }) {
  const [orders, setOrders] = useState(initialOrders)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleFulfill(id: string) {
    setPendingId(id)
    startTransition(async () => {
      try {
        await markPrintOrderFulfilled(id)
        setOrders((prev) => prev.filter((order) => order.id !== id))
        toast.success("Print order marked as fulfilled")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to update print order")
      } finally {
        setPendingId(null)
      }
    })
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        No print orders awaiting fulfillment.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {orders.map((order) => (
        <div
          key={order.id}
          className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Printer className="size-4" />
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground">
                  {order.galleries?.title ?? "Untitled Vault"}
                </span>
                <Badge variant="outline" className="font-mono text-xs">
                  {order.vault_id.slice(0, 8)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{order.client_email}</p>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <ImageIcon className="size-3.5" />
                {order.selected_image_urls.length} image
                {order.selected_image_urls.length === 1 ? "" : "s"} selected
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            disabled={isPending && pendingId === order.id}
            onClick={() => handleFulfill(order.id)}
          >
            {isPending && pendingId === order.id ? "Updating…" : "Mark Fulfilled"}
          </Button>
        </div>
      ))}
    </div>
  )
}
