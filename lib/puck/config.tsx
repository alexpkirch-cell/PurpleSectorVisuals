import type { Config } from "@measured/puck"

import { HeroCarousel3D } from "@/components/home/hero-carousel-3d"
import { HOW_WE_WORK_DEFAULTS, HowWeWorkSection } from "@/components/home/how-we-work-section"
import { JoinTheRosterSection } from "@/components/home/join-the-roster-section"
import { BookingButton } from "@/components/puck/booking-button"
import { ImageFieldInput } from "@/components/puck/image-field"
import { DisciplinesBlock, DualSplitBlock, StudioBlock } from "@/components/puck/site-sections"
import { cn } from "@/lib/utils"

type Align = "left" | "center"

export type PuckComponents = {
  Hero: Record<string, never>
  Text: {
    eyebrow: string
    heading: string
    body: string
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
  Studio: Record<string, never>
  DualSplit: Record<string, never>
  Disciplines: Record<string, never>
  JoinRoster: Record<string, never>
}

export type PuckRootProps = {
  title: string
  description: string
}

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
    render: ({ children }) => <div className="min-h-screen w-full bg-[#09090b] text-foreground">{children}</div>,
  },
  categories: {
    sections: {
      title: "Homepage sections",
      components: ["Hero", "Text", "Studio", "DualSplit", "Disciplines", "JoinRoster"],
    },
    content: { title: "Content", components: ["Image", "BookingButton"] },
  },
  components: {
    Hero: {
      label: "Hero Section",
      fields: {},
      render: () => <HeroCarousel3D />,
    },

    Text: {
      label: "Text / Copy",
      fields: {
        eyebrow: { type: "text", label: "Eyebrow (small label)" },
        heading: { type: "text", label: "Heading" },
        body: { type: "textarea", label: "Body (blank line starts a new paragraph)" },
      },
      defaultProps: {
        eyebrow: HOW_WE_WORK_DEFAULTS.eyebrow,
        heading: HOW_WE_WORK_DEFAULTS.heading,
        body: HOW_WE_WORK_DEFAULTS.body,
      },
      render: ({ eyebrow, heading, body }) => <HowWeWorkSection eyebrow={eyebrow} heading={heading} body={body} />,
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
      render: ({ src, alt, caption, aspect, puck }) => (
        <section className="w-full bg-[#09090b]">
          <figure className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-12 sm:px-10">
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt={alt}
                className={cn(
                  "w-full rounded-3xl border border-zinc-800 object-cover shadow-2xl shadow-black/60",
                  aspectClass[aspect]
                )}
              />
            ) : (
              <div
                className={cn(
                  "flex w-full items-center justify-center rounded-3xl border border-dashed border-zinc-700 bg-zinc-900/60 px-6 text-center text-sm text-zinc-400",
                  aspectClass[aspect]
                )}
              >
                {puck.isEditing ? "Select this block, then upload a picture in the right-hand panel." : null}
              </div>
            )}
            {caption ? (
              <figcaption className="font-heading text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">
                {caption}
              </figcaption>
            ) : null}
          </figure>
        </section>
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
        align: {
          type: "radio",
          label: "Alignment",
          options: [
            { label: "Left", value: "left" },
            { label: "Center", value: "center" },
          ],
        },
      },
      defaultProps: { label: "Book a shoot", shooterId: "", variant: "default", align: "center" },
      render: ({ label, shooterId, variant, align }) => (
        <section className="w-full bg-[#09090b]">
          <div
            className={cn(
              "mx-auto flex max-w-6xl px-6 py-12 sm:px-10",
              align === "center" ? "justify-center" : "justify-start"
            )}
          >
            <BookingButton label={label} shooterId={shooterId || undefined} variant={variant} />
          </div>
        </section>
      ),
    },

    Studio: { label: "The Studio", fields: {}, render: () => <StudioBlock /> },
    DualSplit: { label: "Dual Split (Team)", fields: {}, render: () => <DualSplitBlock /> },
    Disciplines: { label: "Disciplines", fields: {}, render: () => <DisciplinesBlock /> },
    JoinRoster: { label: "Join the Roster", fields: {}, render: () => <JoinTheRosterSection /> },
  },
}
