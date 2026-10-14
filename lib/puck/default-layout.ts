import type { Data } from "@measured/puck"

export const DEFAULT_LAYOUT = {
  root: {
    props: {
      title: "Purple Sector Visuals",
      description: "Motorsport photography, delivered fast. Trackside coverage and a private client vault.",
    },
  },
  content: [
    {
      type: "Hero",
      props: {
        id: "hero-default",
        eyebrow: "Purple Sector Visuals",
        heading: "Motorsport photography, delivered fast.",
        subheading: "Trackside coverage, a private client vault, and edits that match the pace of the weekend.",
        backgroundImage: "/images/hero.png",
        align: "left",
        ctaLabel: "Book a shoot",
      },
    },
    {
      type: "BookingButton",
      props: {
        id: "booking-default",
        label: "Book a shoot",
        shooterId: "",
        variant: "default",
        align: "center",
      },
    },
  ],
} as Data

export function isEmptyLayout(data: Data | null | undefined) {
  return !data || !Array.isArray(data.content) || data.content.length === 0
}
