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

// Flat underline tabs: muted when inactive, bright text with a purple underline when active, never a fill.
const TAB_TRIGGER_CLASS =
  "h-auto flex-1 flex-col gap-1 rounded-none px-2 pt-1 pb-3 text-muted-foreground hover:text-foreground data-active:text-foreground sm:flex-none sm:flex-row sm:gap-2 sm:px-1 after:bg-primary group-data-horizontal/tabs:after:bottom-[-1px] group-data-horizontal/tabs:after:h-0.5"

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
  clientSignatureImage: string | null
  clientSignedAt: string | null
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
  clientSignatureImage,
  clientSignedAt,
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
    <Tabs value={tab} onValueChange={(value) => setTab(value as PortalTab)} className="gap-8">
      <TabsList
        variant="line"
        aria-label="Client vault sections"
        className="h-auto w-full justify-start gap-0 rounded-none border-b border-border p-0 group-data-horizontal/tabs:h-auto sm:gap-4"
      >
        <TabsTrigger value="paperwork" className={TAB_TRIGGER_CLASS}>
          <FileText className="h-4 w-4" />
          <span className="text-xs sm:text-sm">Paperwork</span>
        </TabsTrigger>
        <TabsTrigger value="prep" className={TAB_TRIGGER_CLASS}>
          <ClipboardList className="h-4 w-4" />
          <span className="text-xs sm:text-sm">
            Prep<span className="hidden sm:inline"> &amp; Planning</span>
          </span>
        </TabsTrigger>
        <TabsTrigger value="tracker" className={TAB_TRIGGER_CLASS}>
          <Route className="h-4 w-4" />
          <span className="text-xs sm:text-sm">Tracker</span>
        </TabsTrigger>
        <TabsTrigger value="delivery" disabled={!delivered} className={TAB_TRIGGER_CLASS}>
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
          clientSignatureImage={clientSignatureImage}
          clientSignedAt={clientSignedAt}
          countersignature={live.countersignature}
          countersignedAt={live.countersignedAt}
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
