import type { Config, CustomField, Fields } from "@measured/puck"

import { HERO_SLOT_LABELS } from "@/components/home/hero-carousel-3d"
import { HOW_WE_WORK_DEFAULTS, HowWeWorkSection } from "@/components/home/how-we-work-section"
import { JoinTheRosterSection } from "@/components/home/join-the-roster-section"
import { BookingButton } from "@/components/puck/booking-button"
import { ImageFieldInput } from "@/components/puck/image-field"
import {
  BookingFormBlock,
  DemoVaultBlock,
  PackagesBlock,
  PageHeaderBlock,
  VaultLoginBlock,
  WorkGalleryBlock,
  type BlockWidth,
} from "@/components/puck/page-blocks"
import {
  CreatorBlock,
  DisciplinesBlock,
  DualSplitBlock,
  HeroBlock,
  StudioBlock,
} from "@/components/puck/site-sections"
import {
  DEFAULT_CUSTOM_HEIGHT,
  resolveImageSizing,
  SmartImage,
  type ImageObjectFit,
  type ImageSizing,
} from "@/components/puck/smart-image"
import {
  resolveSpecialtyName,
  SPECIALTY_OPTIONS,
  SpecialtyBlock,
  type SpecialtyType,
} from "@/components/puck/specialty-block"
import type { PuckBlockMetadata } from "@/lib/puck/block-metadata"
import { cn } from "@/lib/utils"

type Align = "left" | "center"

const blockMetadata = (puck: { metadata?: unknown }) => (puck.metadata ?? {}) as Partial<PuckBlockMetadata>

const widthField = {
  type: "select",
  label: "Content width",
  options: [
    { label: "Wide", value: "wide" },
    { label: "Medium", value: "medium" },
    { label: "Narrow", value: "narrow" },
  ],
} as const

/** Every photo slot in the editor uses this: file picker -> Supabase `public_site_assets` -> public URL. */
const imageField = (label: string): CustomField<string> => ({
  type: "custom",
  label,
  render: ({ value, onChange }) => <ImageFieldInput value={value ?? ""} onChange={onChange} />,
})

const PHOTO_INFO_KEYS = ["title", "category", "shooter", "camera", "lens", "settings"] as const
type PhotoInfo = Record<(typeof PHOTO_INFO_KEYS)[number], string>

const PHOTO_INFO_LABELS: Record<(typeof PHOTO_INFO_KEYS)[number], string> = {
  title: "Title",
  category: "Category",
  shooter: "Photographer (name links to their page)",
  camera: "Camera",
  lens: "Lens",
  settings: "Settings (e.g. f/2.8, 1/1000s, ISO 400)",
}

const emptyPhotoInfo = (): PhotoInfo => ({ title: "", category: "", shooter: "", camera: "", lens: "", settings: "" })

const photoInfoFields = Object.fromEntries(
  PHOTO_INFO_KEYS.map((key) => [key, { type: "text", label: PHOTO_INFO_LABELS[key] }])
) as Record<(typeof PHOTO_INFO_KEYS)[number], { type: "text"; label: string }>

const HERO_FIELD_KEYS = ["card1", "card2", "card3", "card4", "card5"] as const
const DUAL_SPLIT_FIELD_KEYS = [
  "alexMain",
  "alexCard0",
  "alexCard1",
  "alexCard2",
  "gabeMain",
  "gabeCard0",
  "gabeCard1",
  "gabeCard2",
] as const
const DISCIPLINE_FIELD_KEYS = ["sports", "automotive", "portraits", "events"] as const

type HeroProps = Record<(typeof HERO_FIELD_KEYS)[number], string> &
  Partial<Record<`${(typeof HERO_FIELD_KEYS)[number]}Info`, PhotoInfo>>
type DualSplitProps = Record<(typeof DUAL_SPLIT_FIELD_KEYS)[number], string>
type DisciplineHrefKey = `${(typeof DISCIPLINE_FIELD_KEYS)[number]}Href`
type DisciplinesProps = Record<(typeof DISCIPLINE_FIELD_KEYS)[number], string> &
  Partial<Record<DisciplineHrefKey, string>>

const emptyProps = <K extends string>(keys: readonly K[]) =>
  Object.fromEntries(keys.map((key) => [key, ""])) as Record<K, string>

const DUAL_SPLIT_LABELS: Record<(typeof DUAL_SPLIT_FIELD_KEYS)[number], string> = {
  alexMain: "Alex: personality shot",
  alexCard0: "Alex: BTS 1",
  alexCard1: "Alex: BTS 2",
  alexCard2: "Alex: BTS 3",
  gabeMain: "Gabe: personality shot",
  gabeCard0: "Gabe: BTS 1",
  gabeCard1: "Gabe: BTS 2",
  gabeCard2: "Gabe: BTS 3",
}

const DISCIPLINE_LABELS: Record<(typeof DISCIPLINE_FIELD_KEYS)[number], string> = {
  sports: "Sports",
  automotive: "Automotive",
  portraits: "Portraits",
  events: "Events",
}

export type PuckComponents = {
  Hero: HeroProps
  Text: {
    eyebrow: string
    heading: string
    body: string
  }
  Image: Partial<PhotoInfo> & {
    src: string
    alt: string
    caption: string
    sizing: ImageSizing
    objectFit: ImageObjectFit
    customHeight: number
    /** Legacy field from before `sizing` existed; only read to keep old pages looking the same. */
    aspect?: "video" | "square" | "portrait"
  }
  Specialty: {
    specialtyType: SpecialtyType
    customSpecialtyName: string
    description: string
    image: string
  }
  BookingButton: {
    label: string
    shooterId: string
    variant: "default" | "outline" | "secondary"
    align: Align
  }
  Studio: {
    images?: { src: string }[]
    /** Legacy fixed slots from before `images` existed; only read when `images` was never saved. */
    reel?: string
    sports?: string
    portrait?: string
    bts?: { src: string }[]
  }
  DualSplit: DualSplitProps
  Disciplines: DisciplinesProps
  JoinRoster: Record<string, never>
  PageHeader: {
    eyebrow: string
    heading: string
    body: string
    align: Align
    width: BlockWidth
    style: "large" | "compact"
  }
  WorkGallery: { width: BlockWidth }
  PackagesConfigurator: Record<string, never>
  BookingForm: { width: BlockWidth }
  VaultLogin: { eyebrow: string; heading: string; body: string }
  DemoVault: { eyebrow: string; heading: string; body: string; photos: { src: string }[] }
  CreatorProfile: {
    name: "Alex" | "Gabe"
    role: string
    bio: string
    specialties: { tag: string }[]
    heroImage: string
    shotsHeading: string
    galleryLabel: string
    ctaLine: string
    bookLabel: string
    shots: { src: string; title: string; category: string }[]
  }
}

export type PuckRootProps = {
  title: string
  description: string
}

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
    content: { title: "Content", components: ["PageHeader", "Image", "Specialty", "BookingButton"] },
    pages: {
      title: "Page sections",
      components: ["WorkGallery", "PackagesConfigurator", "BookingForm", "CreatorProfile", "VaultLogin", "DemoVault"],
    },
  },
  components: {
    Hero: {
      label: "Hero Section",
      fields: Object.fromEntries(
        HERO_FIELD_KEYS.flatMap((key, i) => [
          [key, imageField(`Photo ${i + 1}: ${HERO_SLOT_LABELS[i]}`)],
          [
            `${key}Info`,
            { type: "object", label: `Photo ${i + 1} details (shown when clicked)`, objectFields: photoInfoFields },
          ],
        ])
      ) as unknown as Fields<HeroProps>,
      defaultProps: {
        ...emptyProps(HERO_FIELD_KEYS),
        ...Object.fromEntries(HERO_FIELD_KEYS.map((key) => [`${key}Info`, emptyPhotoInfo()])),
      },
      resolveData: ({ props }) => ({
        props: {
          ...props,
          ...Object.fromEntries(HERO_FIELD_KEYS.map((key) => [`${key}Info`, { ...emptyPhotoInfo(), ...props[`${key}Info`] }])),
        },
      }),
      render: (props) => (
        <HeroBlock photos={HERO_FIELD_KEYS.map((key) => ({ src: props[key], ...props[`${key}Info`] }))} />
      ),
    },

    Text: {
      label: "Text / Copy",
      fields: {
        eyebrow: { type: "text", label: "Eyebrow (small label)", contentEditable: true },
        heading: { type: "text", label: "Heading", contentEditable: true },
        body: { type: "textarea", label: "Body (blank line starts a new paragraph)", contentEditable: true },
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
        src: imageField("Image"),
        alt: { type: "text", label: "Alt text" },
        caption: { type: "text", label: "Caption (optional)", contentEditable: true },
        sizing: {
          type: "radio",
          label: "Sizing",
          options: [
            { label: "Auto", value: "auto" },
            { label: "Square (1:1)", value: "square" },
            { label: "Portrait (4:5)", value: "portrait" },
            { label: "Vertical / Mobile (9:16)", value: "vertical" },
            { label: "Landscape (16:9)", value: "landscape" },
            { label: "Custom Height", value: "custom" },
          ],
        },
        objectFit: {
          type: "select",
          label: "Object fit",
          options: [
            { label: "Cover (fill and crop)", value: "cover" },
            { label: "Contain (show whole image)", value: "contain" },
          ],
        },
        customHeight: { type: "number", label: "Custom height (px)", min: 120, max: 1600, step: 10 },
        ...photoInfoFields,
      },
      defaultProps: {
        src: "",
        alt: "",
        caption: "",
        sizing: "landscape",
        objectFit: "cover",
        customHeight: DEFAULT_CUSTOM_HEIGHT,
        ...emptyPhotoInfo(),
      },
      resolveFields: (data, { fields }) => {
        const { objectFit, customHeight, ...base } = fields
        const sizing = resolveImageSizing(data.props.sizing, data.props.aspect)
        return {
          ...base,
          ...(sizing !== "auto" ? { objectFit } : {}),
          ...(sizing === "custom" ? { customHeight } : {}),
        } as typeof fields
      },
      render: ({ src, alt, caption, sizing, objectFit, customHeight, aspect, puck, title, category, shooter, camera, lens, settings }) => (
        <section className="w-full bg-[#09090b]">
          <figure className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-12 sm:px-10">
            <SmartImage
              src={src}
              alt={alt}
              info={{ title, category, shooter, camera, lens, settings }}
              sizing={resolveImageSizing(sizing, aspect)}
              objectFit={objectFit}
              customHeight={customHeight}
              emptyLabel={puck.isEditing ? "Select this block, then upload a picture in the right-hand panel." : undefined}
            />
            {caption ? (
              <figcaption className="font-heading text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">
                {caption}
              </figcaption>
            ) : null}
          </figure>
        </section>
      ),
    },

    Specialty: {
      label: "Specialty / Service",
      fields: {
        specialtyType: { type: "select", label: "Specialty", options: SPECIALTY_OPTIONS },
        customSpecialtyName: { type: "text", label: "Custom specialty name", placeholder: "e.g. Real estate" },
        description: { type: "textarea", label: "Description", contentEditable: true },
        image: imageField("Photo (optional)"),
      },
      defaultProps: {
        specialtyType: "Portraits",
        customSpecialtyName: "",
        description: "Signature portraits that capture personality, light, and mood.",
        image: "",
      },
      resolveFields: (data, { fields }) => {
        const { customSpecialtyName, ...base } = fields
        if (data.props.specialtyType !== "custom") return base as typeof fields
        return {
          specialtyType: base.specialtyType,
          customSpecialtyName,
          description: base.description,
          image: base.image,
        }
      },
      render: ({ specialtyType, customSpecialtyName, description, image }) => (
        <SpecialtyBlock
          name={resolveSpecialtyName(specialtyType, customSpecialtyName)}
          description={description}
          image={image}
          imageAlt={resolveSpecialtyName(specialtyType, customSpecialtyName)}
        />
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

    Studio: {
      label: "The Studio",
      fields: {
        images: {
          type: "array",
          label: "Studio photos (add as many as you like)",
          arrayFields: { src: imageField("Photo") },
          defaultItemProps: { src: "" },
          getItemSummary: (_item, i) => `Photo ${(i ?? 0) + 1}`,
        },
      },
      defaultProps: {
        images: Array.from({ length: 6 }, () => ({ src: "" })),
      },
      render: ({ images, reel, sports, portrait, bts }) => (
        <StudioBlock
          images={{
            gallery: images?.map((item) => item.src),
            reel,
            sports,
            portrait,
            bts: bts?.map((item) => item.src),
          }}
        />
      ),
    },
    DualSplit: {
      label: "Founders Split (Alex & Gabe)",
      fields: Object.fromEntries(
        DUAL_SPLIT_FIELD_KEYS.map((key) => [key, imageField(DUAL_SPLIT_LABELS[key])])
      ) as Record<(typeof DUAL_SPLIT_FIELD_KEYS)[number], CustomField<string>>,
      defaultProps: emptyProps(DUAL_SPLIT_FIELD_KEYS),
      render: ({ id: _id, puck: _puck, editMode: _editMode, ...images }) => <DualSplitBlock images={images} />,
    },
    Disciplines: {
      label: "Disciplines",
      fields: {
        ...(Object.fromEntries(
          DISCIPLINE_FIELD_KEYS.map((key) => [key, imageField(DISCIPLINE_LABELS[key])])
        ) as Record<(typeof DISCIPLINE_FIELD_KEYS)[number], CustomField<string>>),
        ...(Object.fromEntries(
          DISCIPLINE_FIELD_KEYS.map((key) => [
            `${key}Href`,
            { type: "text", label: `${DISCIPLINE_LABELS[key]}: View Gallery link` },
          ])
        ) as Record<DisciplineHrefKey, { type: "text"; label: string }>),
      },
      defaultProps: {
        ...emptyProps(DISCIPLINE_FIELD_KEYS),
        sportsHref: "/work?category=Sports",
        automotiveHref: "/work?category=Automotive",
        portraitsHref: "/work?category=Portraits",
        eventsHref: "/work?category=Events",
      },
      render: (props) => (
        <DisciplinesBlock
          images={Object.fromEntries(DISCIPLINE_FIELD_KEYS.map((key) => [key, props[key]]))}
          hrefs={Object.fromEntries(DISCIPLINE_FIELD_KEYS.map((key) => [key, props[`${key}Href`]]))}
        />
      ),
    },
    JoinRoster: { label: "Join the Roster", fields: {}, render: () => <JoinTheRosterSection /> },

    PageHeader: {
      label: "Page Header",
      fields: {
        eyebrow: { type: "text", label: "Eyebrow (small label)", contentEditable: true },
        heading: { type: "text", label: "Heading", contentEditable: true },
        body: { type: "textarea", label: "Intro text", contentEditable: true },
        align: {
          type: "radio",
          label: "Alignment",
          options: [
            { label: "Left", value: "left" },
            { label: "Center", value: "center" },
          ],
        },
        style: {
          type: "radio",
          label: "Size",
          options: [
            { label: "Large", value: "large" },
            { label: "Compact", value: "compact" },
          ],
        },
        width: widthField,
      },
      defaultProps: {
        eyebrow: "Purple Sector Visuals",
        heading: "Page heading",
        body: "",
        align: "left",
        width: "wide",
        style: "large",
      },
      render: ({ puck: _puck, ...props }) => <PageHeaderBlock {...props} />,
    },

    WorkGallery: {
      label: "Work Gallery",
      fields: { width: widthField },
      defaultProps: { width: "wide" },
      render: ({ width, puck }) => <WorkGalleryBlock width={width} items={blockMetadata(puck).portfolioItems ?? []} />,
    },

    PackagesConfigurator: {
      label: "Packages Configurator",
      fields: {},
      render: ({ puck }) => <PackagesBlock packages={blockMetadata(puck).packages ?? []} />,
    },

    BookingForm: {
      label: "Booking Form",
      fields: { width: widthField },
      defaultProps: { width: "medium" },
      render: ({ width, puck }) => (
        <BookingFormBlock
          width={width}
          packages={blockMetadata(puck).packages ?? []}
          requestedShooter={blockMetadata(puck).requestedShooter ?? null}
        />
      ),
    },

    VaultLogin: {
      label: "Vault Login",
      fields: {
        eyebrow: { type: "text", label: "Small label", contentEditable: true },
        heading: { type: "text", label: "Heading", contentEditable: true },
        body: { type: "textarea", label: "Intro text", contentEditable: true },
      },
      defaultProps: { eyebrow: "PURPLE SECTOR VISUALS", heading: "Client Vault", body: "" },
      render: ({ eyebrow, heading, body }) => <VaultLoginBlock eyebrow={eyebrow} heading={heading} body={body} />,
    },

    DemoVault: {
      label: "Demo Vault Gallery",
      fields: {
        eyebrow: { type: "text", label: "Small label", contentEditable: true },
        heading: { type: "text", label: "Heading", contentEditable: true },
        body: { type: "textarea", label: "Intro text", contentEditable: true },
        photos: {
          type: "array",
          label: "Sample photos",
          max: 12,
          arrayFields: { src: imageField("Photo") },
          defaultItemProps: { src: "" },
          getItemSummary: (_item, i) => `Photo ${(i ?? 0) + 1}`,
        },
      },
      defaultProps: {
        eyebrow: "DEMO VAULT",
        heading: "Sample Gallery",
        body: "",
        photos: Array.from({ length: 6 }, (_, i) => ({ src: `/placeholders/${i + 1}.jpg` })),
      },
      render: ({ puck: _puck, ...props }) => <DemoVaultBlock {...props} />,
    },

    CreatorProfile: {
      label: "Photographer Profile",
      fields: {
        name: {
          type: "radio",
          label: "Photographer",
          options: [
            { label: "Alex", value: "Alex" },
            { label: "Gabe", value: "Gabe" },
          ],
        },
        role: { type: "text", label: "Role / specialty line" },
        bio: { type: "textarea", label: "Bio" },
        specialties: {
          type: "array",
          label: "Specialty tags",
          arrayFields: { tag: { type: "text", label: "Tag" } },
          defaultItemProps: { tag: "New specialty" },
          getItemSummary: (item) => item.tag || "Tag",
        },
        heroImage: imageField("Hero portrait"),
        shotsHeading: { type: "text", label: "Gallery heading" },
        galleryLabel: { type: "text", label: "Full gallery link label" },
        shots: {
          type: "array",
          label: "Selected work",
          arrayFields: {
            src: imageField("Photo"),
            title: { type: "text", label: "Title" },
            category: { type: "text", label: "Category" },
          },
          defaultItemProps: { src: "", title: "New shot", category: "Sports" },
          getItemSummary: (item, i) => item.title || `Shot ${(i ?? 0) + 1}`,
        },
        ctaLine: { type: "text", label: "Booking bar text" },
        bookLabel: { type: "text", label: "Booking button label" },
      },
      defaultProps: {
        name: "Alex",
        role: "",
        bio: "",
        specialties: [],
        heroImage: "",
        shotsHeading: "Selected work",
        galleryLabel: "Full gallery",
        ctaLine: "Ready to shoot?",
        bookLabel: "Book now",
        shots: [],
      },
      render: ({ specialties, shots, puck: _puck, ...rest }) => (
        <CreatorBlock
          {...rest}
          specialties={specialties.map((item) => item.tag)}
          shotContent={shots}
        />
      ),
    },
  },
}
