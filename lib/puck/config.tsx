import type { Config } from "@measured/puck"

import { BookingButton } from "@/components/puck/booking-button"
import { ImageFieldInput } from "@/components/puck/image-field"
import { cn } from "@/lib/utils"

type Align = "left" | "center"

export type PuckComponents = {
  Hero: {
    eyebrow: string
    heading: string
    subheading: string
    backgroundImage: string
    align: Align
    ctaLabel: string
  }
  Text: {
    heading: string
    body: string
    align: Align
    width: "narrow" | "wide"
  }
  Image: {
    src: string
    alt: string
    caption: string
    aspect: "video" | "square" | "portrait"
  }
  BookingButton: {
    label: string
    shooterId: string
    variant: "default" | "outline" | "secondary"
    align: Align
  }
}

export type PuckRootProps = {
  title: string
  description: string
}

const alignOptions = [
  { label: "Left", value: "left" },
  { label: "Center", value: "center" },
]

const aspectClass = {
  video: "aspect-video",
  square: "aspect-square",
  portrait: "aspect-[3/4]",
} as const

export const puckConfig: Config<PuckComponents, PuckRootProps> = {
  root: {
    fields: {
      title: { type: "text", label: "Page title (SEO)" },
      description: { type: "textarea", label: "Meta description (SEO)" },
    },
    defaultProps: { title: "", description: "" },
    render: ({ children }) => <>{children}</>,
  },
  categories: {
    layout: { title: "Sections", components: ["Hero", "Text", "Image"] },
    actions: { title: "Actions", components: ["BookingButton"] },
  },
  components: {
    Hero: {
      label: "Hero Section",
      fields: {
        eyebrow: { type: "text", label: "Eyebrow" },
        heading: { type: "textarea", label: "Heading" },
        subheading: { type: "textarea", label: "Subheading" },
        backgroundImage: {
          type: "custom",
          label: "Background image",
          render: ({ value, onChange }) => <ImageFieldInput value={value} onChange={onChange} />,
        },
        align: { type: "radio", label: "Alignment", options: alignOptions },
        ctaLabel: { type: "text", label: "Booking button label (leave empty to hide)" },
      },
      defaultProps: {
        eyebrow: "Purple Sector Visuals",
        heading: "Motorsport photography, delivered fast.",
        subheading: "Trackside coverage, a private client vault, and edits that match the pace of the weekend.",
        backgroundImage: "",
        align: "left",
        ctaLabel: "Book a shoot",
      },
      render: ({ eyebrow, heading, subheading, backgroundImage, align, ctaLabel }) => (
        <section className="relative isolate flex min-h-[32rem] items-end overflow-hidden border-b border-border bg-background md:min-h-[40rem]">
          {backgroundImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={backgroundImage} alt="" className="absolute inset-0 -z-20 size-full object-cover" />
          ) : (
            <div className="absolute inset-0 -z-20 bg-card" />
          )}
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-background/70 to-background/20" />
          <div
            className={cn(
              "mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 pt-32 pb-16 md:pb-24",
              align === "center" ? "items-center text-center" : "items-start text-left"
            )}
          >
            {eyebrow ? (
              <span className="flex items-center gap-3 font-heading text-xs font-bold tracking-[0.3em] text-foreground uppercase">
                <span aria-hidden="true" className="h-0.5 w-10 bg-primary shadow-[0_0_12px_var(--primary)]" />
                {eyebrow}
              </span>
            ) : null}
            <h1 className="max-w-4xl font-heading text-5xl leading-[0.95] font-bold tracking-tight text-balance text-foreground uppercase md:text-7xl lg:text-8xl">
              {heading}
            </h1>
            {subheading ? (
              <p className="max-w-xl text-base leading-relaxed text-pretty text-muted-foreground md:text-lg">
                {subheading}
              </p>
            ) : null}
            {ctaLabel ? <BookingButton label={ctaLabel} className="mt-2" /> : null}
          </div>
        </section>
      ),
    },

    Text: {
      label: "Text / Copy",
      fields: {
        heading: { type: "text", label: "Heading (optional)" },
        body: { type: "textarea", label: "Body (blank line starts a new paragraph)" },
        align: { type: "radio", label: "Alignment", options: alignOptions },
        width: {
          type: "radio",
          label: "Width",
          options: [
            { label: "Narrow", value: "narrow" },
            { label: "Wide", value: "wide" },
          ],
        },
      },
      defaultProps: {
        heading: "About the studio",
        body: "Write your copy here.\n\nA blank line starts a new paragraph.",
        align: "left",
        width: "narrow",
      },
      render: ({ heading, body, align, width }) => (
        <section className="bg-background px-6 py-20">
          <div
            className={cn(
              "mx-auto flex flex-col gap-5",
              width === "wide" ? "max-w-5xl" : "max-w-2xl",
              align === "center" ? "items-center text-center" : "items-start text-left"
            )}
          >
            {heading ? (
              <div className={cn("flex flex-col gap-4", align === "center" ? "items-center" : "items-start")}>
                <span aria-hidden="true" className="h-0.5 w-10 bg-primary shadow-[0_0_12px_var(--primary)]" />
                <h2 className="font-heading text-3xl font-bold tracking-tight text-balance text-foreground uppercase md:text-4xl">
                  {heading}
                </h2>
              </div>
            ) : null}
            {body
              .split(/\n{2,}/)
              .filter(Boolean)
              .map((paragraph, index) => (
                <p key={index} className="text-base leading-relaxed text-pretty text-muted-foreground md:text-lg">
                  {paragraph}
                </p>
              ))}
          </div>
        </section>
      ),
    },

    Image: {
      label: "Image",
      fields: {
        src: {
          type: "custom",
          label: "Image",
          render: ({ value, onChange }) => <ImageFieldInput value={value} onChange={onChange} />,
        },
        alt: { type: "text", label: "Alt text" },
        caption: { type: "text", label: "Caption (optional)" },
        aspect: {
          type: "select",
          label: "Aspect ratio",
          options: [
            { label: "Wide (16:9)", value: "video" },
            { label: "Square", value: "square" },
            { label: "Portrait (3:4)", value: "portrait" },
          ],
        },
      },
      defaultProps: { src: "", alt: "", caption: "", aspect: "video" },
      render: ({ src, alt, caption, aspect }) => (
        <figure className="mx-auto flex max-w-6xl flex-col gap-3 bg-background px-6 py-10">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={alt}
              className={cn(
                "w-full rounded-xl border border-border object-cover shadow-2xl shadow-black/60",
                aspectClass[aspect]
              )}
            />
          ) : (
            <div
              className={cn(
                "flex w-full items-center justify-center rounded-xl border border-dashed border-border bg-card text-sm text-muted-foreground",
                aspectClass[aspect]
              )}
            >
              Choose an image
            </div>
          )}
          {caption ? (
            <figcaption className="font-heading text-xs tracking-[0.2em] text-muted-foreground uppercase">
              {caption}
            </figcaption>
          ) : null}
        </figure>
      ),
    },

    BookingButton: {
      label: "Booking Button",
      fields: {
        label: { type: "text", label: "Button label" },
        shooterId: { type: "text", label: "Photographer ID (optional, pre-selects on /book)" },
        variant: {
          type: "select",
          label: "Style",
          options: [
            { label: "Primary", value: "default" },
            { label: "Outline", value: "outline" },
            { label: "Secondary", value: "secondary" },
          ],
        },
        align: { type: "radio", label: "Alignment", options: alignOptions },
      },
      defaultProps: { label: "Book a shoot", shooterId: "", variant: "default", align: "left" },
      render: ({ label, shooterId, variant, align }) => (
        <div
          className={cn(
            "mx-auto flex max-w-6xl bg-background px-6 py-10",
            align === "center" ? "justify-center" : "justify-start"
          )}
        >
          <BookingButton label={label} shooterId={shooterId || undefined} variant={variant} />
        </div>
      ),
    },
  },
}
