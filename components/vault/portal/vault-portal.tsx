"use client"

import { useState } from "react"
import { ClipboardList, FileText, Lock, PackageCheck, Route } from "lucide-react"
import useSWR from "swr"

import { getVaultProgress, type VaultProgress } from "@/app/actions/vault-portal"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DeliveryTab } from "@/components/vault/portal/delivery-tab"
import { PaperworkTab } from "@/components/vault/portal/paperwork-tab"
import { PrepTab } from "@/components/vault/portal/prep-tab"
import { TrackerTab } from "@/components/vault/portal/tracker-tab"
import { isDeliveredStatus } from "@/lib/vault-progress"
import type { InvoiceData } from "@/lib/vault-documents"

const POLL_INTERVAL_MS = 8000

interface VaultPortalProps {
  vaultId: string
  token: string
  category: string | null
  location: string | null
  shootDateLabel: string | null
  contractHtml: string | null
  invoice: InvoiceData | null
  isComped: boolean
  balanceDue: number | null
  mustHaveShots: string | null
  moodBoardLinks: string | null
  prepSubmitted: boolean
  initialProgress: VaultProgress
}

type PortalTab = "paperwork" | "prep" | "tracker" | "delivery"

export function VaultPortal({
  vaultId,
  token,
  category,
  location,
  shootDateLabel,
  contractHtml,
  invoice,
  isComped,
  balanceDue,
  mustHaveShots,
  moodBoardLinks,
  prepSubmitted,
  initialProgress,
}: VaultPortalProps) {
  // Polling keeps the tracker and the locked delivery tab in step with the admin's Kanban board.
  const { data: progress = initialProgress } = useSWR<VaultProgress | null>(
    ["vault-progress", vaultId],
    () => getVaultProgress(vaultId),
    { fallbackData: initialProgress, refreshInterval: POLL_INTERVAL_MS, revalidateOnFocus: true }
  )
  const live = progress ?? initialProgress

  const paperworkDone = live.contractSigned && (live.depositPaid || isComped)
  const delivered = isDeliveredStatus(live.shootStatus)

  const [tab, setTab] = useState<PortalTab>(delivered ? "delivery" : paperworkDone ? "tracker" : "paperwork")

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value as PortalTab)} className="gap-6">
      <TabsList className="grid h-auto w-full grid-cols-4">
        <TabsTrigger value="paperwork" className="flex-col gap-1 py-2 sm:flex-row sm:gap-2">
          <FileText className="h-4 w-4" />
          <span className="text-xs sm:text-sm">Paperwork</span>
        </TabsTrigger>
        <TabsTrigger value="prep" className="flex-col gap-1 py-2 sm:flex-row sm:gap-2">
          <ClipboardList className="h-4 w-4" />
          <span className="text-xs sm:text-sm">
            Prep<span className="hidden sm:inline"> &amp; Planning</span>
          </span>
        </TabsTrigger>
        <TabsTrigger value="tracker" className="flex-col gap-1 py-2 sm:flex-row sm:gap-2">
          <Route className="h-4 w-4" />
          <span className="text-xs sm:text-sm">Tracker</span>
        </TabsTrigger>
        <TabsTrigger value="delivery" disabled={!delivered} className="flex-col gap-1 py-2 sm:flex-row sm:gap-2">
          {delivered ? <PackageCheck className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
          <span className="text-xs sm:text-sm">
            <span className="hidden sm:inline">Final </span>Delivery
          </span>
          {!delivered && <span className="sr-only">(locked until your project is delivered)</span>}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="paperwork">
        <PaperworkTab
          vaultId={vaultId}
          contractSigned={live.contractSigned}
          depositPaid={live.depositPaid}
          contractHtml={contractHtml}
          invoice={invoice}
          isComped={isComped}
          onComplete={() => setTab("prep")}
        />
      </TabsContent>

      <TabsContent value="prep">
        <PrepTab
          vaultId={vaultId}
          category={category}
          location={location}
          shootDateLabel={shootDateLabel}
          initialMustHaveShots={mustHaveShots}
          initialMoodBoardLinks={moodBoardLinks}
          prepSubmitted={prepSubmitted}
        />
      </TabsContent>

      <TabsContent value="tracker">
        <TrackerTab shootStatus={live.shootStatus} photoCount={live.photoCount} />
      </TabsContent>

      {delivered && (
        <TabsContent value="delivery">
          <DeliveryTab galleryHref={`/vault/${token}?view=gallery`} photoCount={live.photoCount} balanceDue={balanceDue} />
        </TabsContent>
      )}
    </Tabs>
  )
}
