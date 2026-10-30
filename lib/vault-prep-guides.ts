export interface PrepGuide {
  title: string
  tips: string[]
}

const PREP_GUIDES: Record<string, PrepGuide> = {
  Portraits: {
    title: "Portrait Session Guidelines",
    tips: [
      "Bring 2-3 outfit options. Solid colors photograph best.",
      "Avoid busy logos or text on clothing.",
      "Get a good night's sleep; we'll handle the rest in retouching.",
      "Arrive 10 minutes early to settle in before we start shooting.",
    ],
  },
  Automotive: {
    title: "Automotive Shoot Guidelines",
    tips: [
      "Wash and detail the vehicle 24-48 hours before the shoot.",
      "Remove parking permits, toll tags, and dealership plates if possible.",
      "Fill the tank. Full tanks look better in fuel gauge shots.",
      "Scout for low-traffic golden-hour windows; we'll confirm timing.",
    ],
  },
  Athletics: {
    title: "Athletics Coverage Guidelines",
    tips: [
      "Send us the game or event schedule and roster in advance.",
      "Confirm sideline or media credential access if required.",
      "Have your athlete's jersey number ready for spotlight requests.",
      "We'll arrive 30 minutes before puck drop, kickoff or tip-off.",
    ],
  },
  Events: {
    title: "Event Coverage Guidelines",
    tips: [
      "Share a run-of-show or timeline so we don't miss key moments.",
      "Point out any VIPs or must-have shots in advance.",
      "Confirm venue photography restrictions ahead of time.",
      "We'll do a walkthrough of the space 15 minutes before start.",
    ],
  },
}

export function prepGuideFor(category: string | null): PrepGuide {
  return PREP_GUIDES[category ?? ""] ?? PREP_GUIDES.Portraits
}
