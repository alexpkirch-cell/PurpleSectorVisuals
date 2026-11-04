import type { Metadata } from "next"

import { listAssignableVaults, listMediaLibrary } from "@/app/actions/media-library"
import { sql } from "@/lib/db"
import { EventUploadQueue } from "@/components/admin/event-upload-queue"

export const metadata: Metadata = {
  title: "Event Uploads | Purple Sector Visuals",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

type EventPhotoRow = {
  id: string
  image_url: string
  matched_face_ids: string[] | null
  created_at: string
}

export default async function EventUploadPage() {
  const [{ rows }, vaults, library] = await Promise.all([
    sql<EventPhotoRow>`
      SELECT id, image_url, matched_face_ids, created_at
      FROM event_photos
      ORDER BY created_at DESC
      LIMIT 60
    `,
    listAssignableVaults(),
    listMediaLibrary(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-medium text-foreground">Event Uploads</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload event photos, review the queue, and optionally route the batch straight into a client&apos;s Final Delivery.
        </p>
      </div>

      <EventUploadQueue vaults={vaults} shooters={library.shooters} editors={library.editors} />

      {rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No event photos have been processed yet.
        </div>
      ) : (
        <ul className="columns-2 gap-3 md:columns-4 xl:columns-6">
          {rows.map((photo) => (
            <li key={photo.id} className="mb-3 flex break-inside-avoid flex-col gap-1.5">
              <div className="w-full overflow-hidden rounded-md border border-border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.image_url} alt="Event photo" loading="lazy" className="block h-auto w-full" />
              </div>
              <span className="text-xs text-muted-foreground">
                {photo.matched_face_ids?.length ?? 0} matched face
                {(photo.matched_face_ids?.length ?? 0) === 1 ? "" : "s"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
