import type { Data } from "@measured/puck"

const HOME_LAYOUT = {
  root: {
    props: {
      title: "Purple Sector Visuals",
      description: "Motorsport photography, delivered fast. Trackside coverage and a private client vault.",
    },
  },
  content: [
    { type: "Hero", props: { id: "home-hero" } },
    { type: "Studio", props: { id: "home-studio" } },
    { type: "Disciplines", props: { id: "home-disciplines" } },
    { type: "DualSplit", props: { id: "home-dual-split" } },
    {
      type: "PageHeader",
      props: {
        id: "home-book-header",
        eyebrow: "PURPLE SECTOR VISUALS",
        heading: "Book a shoot",
        body: "Tell us about your shoot and we'll follow up to confirm the details.",
        align: "center",
        width: "narrow",
        style: "compact",
      },
    },
    { type: "BookingForm", props: { id: "home-book-form", width: "narrow" } },
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

function creatorCardLayout(slug: "alex" | "gabe", name: string, description: string): Data {
  return {
    root: pageRoot(`${name} | Purple Sector Visuals`, description),
    content: [{ type: "CreatorCard", props: { id: `${slug}-creator-card`, slug } }],
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
      return creatorCardLayout(
        "alex",
        "Alex",
        "Alex shoots sports and automotive for Purple Sector Visuals — high-speed action frozen with precision and light."
      )
    case "/gabe":
      return creatorCardLayout(
        "gabe",
        "Gabe",
        "Gabe shoots portraits and events for Purple Sector Visuals — candid atmosphere and character captured with a documentary eye."
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
