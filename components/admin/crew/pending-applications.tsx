import Link from "next/link"

import { Button } from "@/components/ui/button"

export function PendingApplications() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-16 text-center">
      <p className="text-sm font-medium text-foreground">No pending applications</p>
      <p className="max-w-md text-sm text-muted-foreground">
        New roster applications will appear here for review. Independent contractor recruiting is handled in the 1099
        Contractor Hub.
      </p>
      <Button variant="outline" render={<Link href="/admin/crew/contractors" />}>
        Open 1099 Contractor Hub
      </Button>
    </div>
  )
}
