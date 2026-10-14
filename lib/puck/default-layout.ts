import type { Data } from "@measured/puck"

import { HOW_WE_WORK_DEFAULTS } from "@/components/home/how-we-work-section"

const HOME_LAYOUT = {
  root: {
    props: {
      title: "Purple Sector Visuals",
      description: "Motorsport photography, delivered fast. Trackside coverage and a private client vault.",
    },
  },
  content: [
    { type: "Hero", props: { id: "home-hero" } },
    { type: "Text", props: { id: "home-how-we-work", ...HOW_WE_WORK_DEFAULTS } },
    { type: "Studio", props: { id: "home-studio" } },
    { type: "DualSplit", props: { id: "home-dual-split" } },
    { type: "Disciplines", props: { id: "home-disciplines" } },
    { type: "JoinRoster", props: { id: "home-join-roster" } },
  ],
} as Data

const BLANK_PAGE_LAYOUT = {
  root: { props: { title: "", description: "" } },
  content: [
    {
      type: "Text",
      props: {
        id: "page-intro",
        eyebrow: "Purple Sector Visuals",
        heading: "New page",
        body: "Replace this with your own copy, or drag more blocks in from the left.",
      },
    },
    {
      type: "BookingButton",
      props: { id: "page-booking", label: "Book a shoot", shooterId: "", variant: "default", align: "center" },
    },
  ],
} as Data

/** The homepage starts as the live site's real sections; any other new page starts small. */
export function getDefaultLayout(path: string): Data {
  return path === "/" ? HOME_LAYOUT : BLANK_PAGE_LAYOUT
}

export function isEmptyLayout(data: Data | null | undefined) {
  return !data || !Array.isArray(data.content) || data.content.length === 0
}
