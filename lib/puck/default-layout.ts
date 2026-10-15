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

const pageRoot = (title: string, description: string) => ({ props: { title, description } })

const SHOT_TITLES = {
  Alex: [
    { title: "Apex Sprint", category: "Sports" },
    { title: "Studio Light", category: "Portraits" },
    { title: "Chrome & Rain", category: "Automotive" },
    { title: "Grid Walk", category: "Events" },
    { title: "Braking Point", category: "Sports" },
    { title: "Visor Up", category: "Portraits" },
  ],
  Gabe: [
    { title: "Night Circuit", category: "Automotive" },
    { title: "Paddock Pass", category: "Events" },
    { title: "Full Throttle", category: "Sports" },
    { title: "Off Track", category: "Portraits" },
    { title: "Garage Hour", category: "Automotive" },
    { title: "Podium Spray", category: "Events" },
  ],
}

function creatorLayout(
  name: "Alex" | "Gabe",
  description: string,
  role: string,
  bio: string,
  specialties: string[]
): Data {
  return {
    root: pageRoot(`${name} | Purple Sector Visuals`, description),
    content: [
      {
        type: "CreatorProfile",
        props: {
          id: `${name.toLowerCase()}-profile`,
          name,
          role,
          bio,
          specialties: specialties.map((tag) => ({ tag })),
          heroImage: "",
          shotsHeading: "Selected work",
          galleryLabel: "Full gallery",
          shots: SHOT_TITLES[name].map((shot) => ({ src: "", ...shot })),
          ctaLine: `Ready to shoot with ${name}?`,
          bookLabel: `Book with ${name}`,
        },
      },
    ],
  } as Data
}

/** Copy the editor can pre-fill from the site-text settings (contact page headline etc.). */
export type SiteTextDefaults = Record<string, string | undefined>

function builtInLayout(path: string, text: SiteTextDefaults): Data | null {
  switch (path) {
    case "/work":
      return {
        root: pageRoot(
          "Work | Purple Sector Visuals",
          "Browse the full portfolio from Purple Sector Visuals across sports, automotive, portrait, and event photography."
        ),
        content: [
          {
            type: "PageHeader",
            props: {
              id: "work-header",
              eyebrow: "Portfolio",
              heading: "The full body of work.",
              body: "Every frame from our lead shooters, sorted by discipline. Filter to find what matches your project.",
              align: "left",
              width: "wide",
              style: "large",
            },
          },
          { type: "WorkGallery", props: { id: "work-gallery", width: "wide" } },
        ],
      } as Data
    case "/packages":
      return {
        root: pageRoot(
          "Packages | Purple Sector Visuals",
          "Build your coverage: pick a category, choose a base package, and add on exactly what your shoot needs."
        ),
        content: [{ type: "PackagesConfigurator", props: { id: "packages-configurator" } }],
      } as Data
    case "/book":
      return {
        root: pageRoot(
          "Book a Shoot | Purple Sector Visuals",
          "Request a shoot with Purple Sector Visuals and get your client vault access code."
        ),
        content: [
          {
            type: "PageHeader",
            props: {
              id: "book-header",
              eyebrow: "PURPLE SECTOR VISUALS",
              heading: "Book a shoot",
              body: "Tell us about your shoot and we'll follow up to confirm the details.",
              align: "center",
              width: "narrow",
              style: "compact",
            },
          },
          { type: "BookingForm", props: { id: "book-form", width: "narrow" } },
        ],
      } as Data
    case "/contact":
      return {
        root: pageRoot(
          "Contact | Purple Sector Visuals",
          "Book a session with Purple Sector Visuals. Tell us your date, category, and shooter preference."
        ),
        content: [
          {
            type: "PageHeader",
            props: {
              id: "contact-header",
              eyebrow: text["contact.eyebrow"] ?? "Contact",
              heading: text["contact.headline"] ?? "Let's make something fast.",
              body: text["contact.body"] ?? "",
              align: "left",
              width: "medium",
              style: "large",
            },
          },
          { type: "BookingForm", props: { id: "contact-form", width: "medium" } },
        ],
      } as Data
    case "/alex":
      return creatorLayout(
        "Alex",
        "Alex shoots sports and automotive for Purple Sector Visuals — high-speed action frozen with precision and light.",
        "Sports & Automotive",
        "Alex shoots the exact frame where speed becomes still — the apex, the launch, the moment tires break loose. High-speed action and automotive motion, captured with precision.",
        ["Track & Field", "Automotive Motion", "High-Speed Action"]
      )
    case "/gabe":
      return creatorLayout(
        "Gabe",
        "Gabe shoots portraits and events for Purple Sector Visuals — candid atmosphere and character captured with a documentary eye.",
        "Portraits & Events",
        "Gabe builds atmosphere and tone into every frame. Drawn to unscripted moments, his work sits between documentary and portraiture — waiting for the frame no one else caught.",
        ["Portraits", "Live Events", "Atmospheric Composition"]
      )
    case "/vault":
      return {
        root: pageRoot("Client Vault | Purple Sector Visuals", "Access your edited photo gallery from Purple Sector Visuals."),
        content: [
          {
            type: "VaultLogin",
            props: {
              id: "vault-login",
              eyebrow: "PURPLE SECTOR VISUALS",
              heading: "Client Vault",
              body: "Enter your name and the access code from your booking confirmation to unlock your gallery.",
            },
          },
        ],
      } as Data
    case "/vault/demo":
      return {
        root: pageRoot("Demo Gallery | Purple Sector Visuals", "A sample client vault gallery preview."),
        content: [
          {
            type: "DemoVault",
            props: {
              id: "vault-demo",
              eyebrow: "DEMO VAULT",
              heading: "Jordan Rivera's Gallery",
              body: "This is a sample preview of what a delivered client vault looks like. Real galleries include full-resolution downloads for every image.",
              photos: Array.from({ length: 6 }, (_, i) => ({ src: `/placeholders/${i + 1}.jpg` })),
            },
          },
        ],
      } as Data
    default:
      return null
  }
}

/** Home and every built-in page start as the live site's real sections; any other new page starts small. */
export function getDefaultLayout(path: string, text: SiteTextDefaults = {}): Data {
  if (path === "/") return HOME_LAYOUT
  return builtInLayout(path, text) ?? BLANK_PAGE_LAYOUT
}

export function isEmptyLayout(data: Data | null | undefined) {
  return !data || !Array.isArray(data.content) || data.content.length === 0
}
