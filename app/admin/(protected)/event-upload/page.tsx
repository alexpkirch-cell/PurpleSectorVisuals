import type { Metadata } from "next"

import { sql } from "@/lib/db"

export const metadata: Metadata = {
  title: "Event Uploads | Purple Sector Visuals",
  robots: { index: false, follow: false },
}

type EventPhotoRow = {
  id: string
  image_url: string
  matched_face_ids: string[] | null
  created_at: string
}

export default async function EventUploadPage() {
  const { rows } = await sql<EventPhotoRow>`
    SELECT id, image_url, matched_face_ids, created_at
    FROM event_photos
    ORDER BY created_at DESC
    LIMIT 60
  `

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-medium text-foreground">Event Uploads</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Photos processed for facial matching at live events, with the number of matched faces for each.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No event photos have been processed yet.
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
          {rows.map((photo) => (
            <li key={photo.id} className="flex flex-col gap-1.5">
              <div className="relative aspect-[4/5] w-full overflow-hidden rounded-md border border-border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.image_url} alt="Event photo" className="absolute inset-0 size-full object-cover" />
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
