export interface TrackerNode {
  id: "booked" | "culling" | "color_grading" | "final_review" | "delivered"
  label: string
  headline: string
  detail: string
}

export const TRACKER_NODES: readonly TrackerNode[] = [
  {
    id: "booked",
    label: "Booked",
    headline: "You're on the calendar",
    detail: "Your agreement is signed and your date is locked in. We'll see you at the shoot.",
  },
  {
    id: "culling",
    label: "Culling",
    headline: "Selecting your best frames",
    detail: "We're sorting through every raw file and pulling out the strongest images from your session.",
  },
  {
    id: "color_grading",
    label: "Color Grading",
    headline: "Editing in progress",
    detail: "Your selects are in Lightroom and Photoshop getting color, tone and retouching.",
  },
  {
    id: "final_review",
    label: "Final Review",
    headline: "Final quality check",
    detail: "Your edited gallery is staged and getting a last review before it's released to you.",
  },
  {
    id: "delivered",
    label: "Delivered",
    headline: "Your gallery is ready",
    detail: "Everything is finished. Head to the Final Delivery tab to view your gallery.",
  },
]

/**
 * Index of the node the shoot is currently on, or -1 while it is still pre-booking.
 * "Final Review" has no pipeline column of its own: it is reached once the shoot is
 * in color grading and edited photos have started landing in its gallery.
 */
export function trackerIndex(shootStatus: string | null, photoCount: number): number {
  switch (shootStatus) {
    case "booked_paid":
      return 0
    case "culling":
      return 1
    case "color_grading":
      return photoCount > 0 ? 3 : 2
    case "delivered_settled":
      return TRACKER_NODES.length - 1
    default:
      return -1
  }
}

export function isDeliveredStatus(shootStatus: string | null) {
  return shootStatus === "delivered_settled"
}
