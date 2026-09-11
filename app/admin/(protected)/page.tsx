import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Images, LayoutGrid } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Admin | Purple Sector Visuals",
  robots: { index: false, follow: false },
}

export default async function AdminOverviewPage() {
  const supabase = await createClient()
  const [{ count: galleryCount }, { count: slotCount }] = await Promise.all([
    supabase.from("galleries").select("id", { count: "exact", head: true }),
    supabase
      .from("site_slots")
      .select("slot_key", { count: "exact", head: true })
      .not("storage_path", "is", null),
  ])

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-medium text-foreground">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage client delivery galleries and the live site&apos;s placeholder imagery.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href="/admin/galleries">
          <Card className="transition-colors hover:bg-accent/40">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Images className="size-4 text-primary" />
                  <CardTitle>Client Galleries</CardTitle>
                </div>
                <ArrowRight className="size-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-medium text-foreground">{galleryCount ?? 0}</p>
              <p className="text-sm text-muted-foreground">active delivery galleries</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/assets">
          <Card className="transition-colors hover:bg-accent/40">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <LayoutGrid className="size-4 text-primary" />
                  <CardTitle>Site Assets</CardTitle>
                </div>
                <ArrowRight className="size-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-medium text-foreground">{slotCount ?? 0}</p>
              <p className="text-sm text-muted-foreground">wireframe slots replaced</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
