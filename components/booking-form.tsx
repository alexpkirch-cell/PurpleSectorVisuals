"use client"

import { useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowLeft, ArrowRight, Check, PartyPopper } from "lucide-react"

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { InfoBubble } from "@/components/ui/info-bubble"
import { cn } from "@/lib/utils"
import {
  submitBooking,
  type BookingCreator,
  type BookingPackage,
  type BookingSubject,
} from "@/app/actions/booking"

const STEP_TITLES = [
  "The Basics",
  "The Subject",
  "The Creator",
  "The Package",
  "The Details",
]

const SUBJECTS: {
  value: BookingSubject
  label: string
  info: string
}[] = [
  {
    value: "automotive",
    label: "Automotive",
    info: "Static car features, dynamic rolling shots, or full club meets.",
  },
  {
    value: "sports",
    label: "Sports & Action",
    info: "Game-day sideline coverage, track meets, or team tournaments.",
  },
  {
    value: "senior",
    label: "Senior Portraits",
    info: "High school or college graduation photos tailored to your style.",
  },
  {
    value: "headshots",
    label: "Athlete Headshots",
    info: "Moody, high-contrast fitness portraits or recruiting profiles.",
  },
]

const CREATORS: {
  value: BookingCreator
  label: string
  info: string
}[] = [
  {
    value: "match",
    label: "Studio Match",
    info: "We automatically assign the shooter with the best schedule and expertise for your session.",
  },
  { value: "alex", label: "Alex", info: "Request Alex as your primary shooter." },
  { value: "gabe", label: "Gabe", info: "Request Gabe as your primary shooter." },
  {
    value: "dual",
    label: "Dual Coverage",
    info: "Both shooters cover your event simultaneously for maximum angles and a photo/video split.",
  },
]

const PACKAGES: {
  value: BookingPackage
  label: string
  price: string
  info: string
  requiresDual?: boolean
}[] = [
  {
    value: "standard",
    label: "The Standard Session",
    price: "$100–$150",
    info: "45–60 minutes, 15 polished photos. Perfect for single portraits or static car features.",
  },
  {
    value: "action",
    label: "The Action Package",
    price: "$175–$225",
    info: "90 minutes, 25-30 action photos, plus a 15-second vertical video cut.",
  },
  {
    value: "dual-build",
    label: "The Dual Creator Build",
    price: "$300–$350",
    info: "2 hours of full coverage by both creators, 40+ photos, and a custom hype reel.",
    requiresDual: true,
  },
]

interface BookingState {
  firstName: string
  lastName: string
  email: string
  phone: string
  preferredDate: string
  location: string
  subject: BookingSubject | ""
  creator: BookingCreator | ""
  package: BookingPackage | ""
  brief: string
  instagramHandle: string
}

const initialState: BookingState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  preferredDate: "",
  location: "",
  subject: "",
  creator: "",
  package: "",
  brief: "",
  instagramHandle: "",
}

const focusClasses =
  "focus-visible:border-[#e829f1] focus-visible:ring-[#e829f1]/20"

function OptionCard({
  active,
  title,
  description,
  info,
  meta,
  onClick,
}: {
  active: boolean
  title: string
  description?: string
  info: string
  meta?: string
  onClick: () => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onClick()
        }
      }}
      className={cn(
        "flex w-full cursor-pointer flex-col gap-1 rounded-2xl border px-4 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e829f1]/40",
        active
          ? "border-[#e829f1] bg-[#e829f1]/10"
          : "border-zinc-800 bg-transparent hover:border-zinc-700"
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span
            className={cn(
              "flex size-4 shrink-0 items-center justify-center rounded-full border",
              active
                ? "border-[#e829f1] bg-[#e829f1] text-white"
                : "border-zinc-700 text-transparent"
            )}
          >
            <Check className="size-2.5" />
          </span>
          <span className="font-medium text-foreground">{title}</span>
        </span>
        <span className="flex items-center gap-2">
          {meta ? (
            <span className="text-xs font-medium text-[#e829f1]">{meta}</span>
          ) : null}
          <InfoBubble>{info}</InfoBubble>
        </span>
      </span>
      {description ? (
        <span className="pl-6 text-sm leading-relaxed text-zinc-400">
          {description}
        </span>
      ) : null}
    </div>
  )
}

export function BookingForm() {
  const searchParams = useSearchParams()
  const initialCreator = searchParams.get("shooter")
  const initialPackage = searchParams.get("tier")

  const [step, setStep] = useState(1)
  const [direction, setDirection] = useState<1 | -1>(1)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [data, setData] = useState<BookingState>(() => ({
    ...initialState,
    creator: (CREATORS.find((c) => c.value === initialCreator)?.value ??
      "") as BookingCreator | "",
    package: (PACKAGES.find((p) => p.value === initialPackage)?.value ??
      "") as BookingPackage | "",
  }))

  const totalSteps = STEP_TITLES.length

  const availablePackages = useMemo(
    () => PACKAGES.filter((p) => !p.requiresDual || data.creator === "dual"),
    [data.creator]
  )

  function update<K extends keyof BookingState>(key: K, value: BookingState[K]) {
    setData((prev) => {
      const next = { ...prev, [key]: value }
      if (
        key === "creator" &&
        value !== "dual" &&
        prev.package === "dual-build"
      ) {
        next.package = ""
      }
      return next
    })
  }

  function isStepValid(current: number) {
    switch (current) {
      case 1:
        return Boolean(
          data.firstName.trim() &&
            data.lastName.trim() &&
            data.email.trim() &&
            data.phone.trim() &&
            data.preferredDate.trim() &&
            data.location.trim()
        )
      case 2:
        return Boolean(data.subject)
      case 3:
        return Boolean(data.creator)
      case 4:
        return Boolean(data.package)
      default:
        return true
    }
  }

  function goNext() {
    if (!isStepValid(step)) return
    setDirection(1)
    setStep((s) => Math.min(s + 1, totalSteps))
  }

  function goBack() {
    setDirection(-1)
    setStep((s) => Math.max(s - 1, 1))
  }

  async function handleSubmit() {
    if (!isStepValid(4) || !data.subject || !data.creator || !data.package) return
    setSubmitting(true)
    setSubmitError(null)

    const result = await submitBooking({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      preferredDate: data.preferredDate,
      location: data.location,
      subject: data.subject,
      creator: data.creator,
      package: data.package,
      brief: data.brief,
      instagramHandle: data.instagramHandle,
    })

    setSubmitting(false)

    if (!result.success) {
      setSubmitError(result.error)
      return
    }

    setSubmitted(true)
  }

  const summarySubject = SUBJECTS.find((s) => s.value === data.subject)
  const summaryCreator = CREATORS.find((c) => c.value === data.creator)
  const summaryPackage = PACKAGES.find((p) => p.value === data.package)

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-[#e829f1]/10 text-[#e829f1]">
          <PartyPopper className="size-7" />
        </span>
        <h2 className="font-heading text-2xl font-bold text-foreground">
          Booking Request Received
        </h2>
        <p className="max-w-md text-pretty text-sm leading-relaxed text-zinc-400">
          You will be contacted within 3 business days to finalize your date,
          location, and details.
        </p>
      </div>
    )
  }

  return (
    <div className="grid w-full gap-8 lg:grid-cols-[1fr_260px]">
      <div className="min-w-0">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
            <span>
              Step {step} of {totalSteps}
            </span>
            <span className="text-[#e829f1]">{STEP_TITLES[step - 1]}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <motion.div
              className="h-full rounded-full bg-[#e829f1]"
              initial={false}
              animate={{ width: `${(step / totalSteps) * 100}%` }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          </div>
        </div>

        <div className="relative overflow-hidden">
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.div
              key={step}
              custom={direction}
              initial={{ x: direction * 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: direction * -40, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="flex flex-col gap-5"
            >
              {step === 1 ? (
                <>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="firstName">First Name</FieldLabel>
                      <Input
                        id="firstName"
                        value={data.firstName}
                        onChange={(e) => update("firstName", e.target.value)}
                        placeholder="Jordan"
                        className={focusClasses}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="lastName">Last Name</FieldLabel>
                      <Input
                        id="lastName"
                        value={data.lastName}
                        onChange={(e) => update("lastName", e.target.value)}
                        placeholder="Rivera"
                        className={focusClasses}
                      />
                    </Field>
                  </div>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="email">Email</FieldLabel>
                      <Input
                        id="email"
                        type="email"
                        value={data.email}
                        onChange={(e) => update("email", e.target.value)}
                        placeholder="you@example.com"
                        className={focusClasses}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="phone">Phone Number</FieldLabel>
                      <Input
                        id="phone"
                        type="tel"
                        value={data.phone}
                        onChange={(e) => update("phone", e.target.value)}
                        placeholder="(555) 010-2020"
                        className={focusClasses}
                      />
                    </Field>
                  </div>
                  <Field>
                    <FieldLabel htmlFor="preferredDate" className="gap-1.5">
                      Preferred Date & Location
                      <InfoBubble>
                        Don&apos;t have an exact date yet? Pick a rough
                        estimate and we will finalize it later.
                      </InfoBubble>
                    </FieldLabel>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Input
                        id="preferredDate"
                        type="date"
                        value={data.preferredDate}
                        onChange={(e) =>
                          update("preferredDate", e.target.value)
                        }
                        className={focusClasses}
                      />
                      <Input
                        id="location"
                        value={data.location}
                        onChange={(e) => update("location", e.target.value)}
                        placeholder="Track, studio, or venue address"
                        className={focusClasses}
                      />
                    </div>
                  </Field>
                </>
              ) : null}

              {step === 2 ? (
                <div className="flex flex-col gap-3">
                  {SUBJECTS.map((subject) => (
                    <OptionCard
                      key={subject.value}
                      active={data.subject === subject.value}
                      title={subject.label}
                      info={subject.info}
                      onClick={() => update("subject", subject.value)}
                    />
                  ))}
                </div>
              ) : null}

              {step === 3 ? (
                <div className="flex flex-col gap-3">
                  {CREATORS.map((creator) => (
                    <OptionCard
                      key={creator.value}
                      active={data.creator === creator.value}
                      title={creator.label}
                      info={creator.info}
                      onClick={() => update("creator", creator.value)}
                    />
                  ))}
                </div>
              ) : null}

              {step === 4 ? (
                <div className="flex flex-col gap-3">
                  {availablePackages.map((pkg) => (
                    <OptionCard
                      key={pkg.value}
                      active={data.package === pkg.value}
                      title={pkg.label}
                      meta={pkg.price}
                      info={pkg.info}
                      description={pkg.info}
                      onClick={() => update("package", pkg.value)}
                    />
                  ))}
                  {data.creator !== "dual" ? (
                    <p className="pl-1 text-xs leading-relaxed text-zinc-500">
                      Select Dual Coverage in the previous step to unlock The
                      Dual Creator Build.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {step === 5 ? (
                <>
                  <Field>
                    <FieldLabel htmlFor="brief" className="gap-1.5">
                      Shoot Brief
                      <InfoBubble>
                        Tell us exactly what you want to capture. Have
                        specific poses or a certain vibe in mind? Drop it
                        here.
                      </InfoBubble>
                    </FieldLabel>
                    <Textarea
                      id="brief"
                      rows={4}
                      value={data.brief}
                      onChange={(e) => update("brief", e.target.value)}
                      placeholder="Describe the vision for your shoot..."
                      className={focusClasses}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="instagramHandle" className="gap-1.5">
                      Instagram Handle
                      <InfoBubble>
                        Drop your IG so we can tag you in teasers!
                      </InfoBubble>
                    </FieldLabel>
                    <Input
                      id="instagramHandle"
                      value={data.instagramHandle}
                      onChange={(e) =>
                        update("instagramHandle", e.target.value)
                      }
                      placeholder="@yourhandle"
                      className={focusClasses}
                    />
                    <FieldDescription>Optional.</FieldDescription>
                  </Field>
                  {submitError ? (
                    <p className="text-sm text-destructive">{submitError}</p>
                  ) : null}
                </>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-8 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={goBack}
            disabled={step === 1}
            className="rounded-full text-zinc-400 hover:text-foreground disabled:opacity-0"
          >
            <ArrowLeft className="size-4" data-icon="inline-start" />
            Back
          </Button>

          {step < totalSteps ? (
            <Button
              type="button"
              onClick={goNext}
              disabled={!isStepValid(step)}
              className="rounded-full bg-[#e829f1] px-6 text-sm font-medium text-white hover:bg-[#e829f1]/90"
            >
              Continue
              <ArrowRight className="size-4" data-icon="inline-end" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !isStepValid(4)}
              className="rounded-full bg-[#e829f1] px-6 text-sm font-medium text-white hover:bg-[#e829f1]/90"
            >
              {submitting ? "Sending..." : "Request Booking"}
            </Button>
          )}
        </div>
      </div>

      {/* Sticky summary */}
      <div className="lg:sticky lg:top-28 lg:self-start">
        <div className="rounded-2xl border border-zinc-800 bg-[#121214]/60 p-5">
          <p className="font-heading text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Your Session
          </p>
          <dl className="mt-4 flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-zinc-500">Name</dt>
              <dd className="truncate text-right text-foreground">
                {data.firstName || data.lastName
                  ? `${data.firstName} ${data.lastName}`.trim()
                  : "—"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-zinc-500">Date</dt>
              <dd className="truncate text-right text-foreground">
                {data.preferredDate || "—"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-zinc-500">Subject</dt>
              <dd className="truncate text-right text-foreground">
                {summarySubject?.label ?? "—"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-zinc-500">Creator</dt>
              <dd className="truncate text-right text-foreground">
                {summaryCreator?.label ?? "—"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-zinc-500">Package</dt>
              <dd className="truncate text-right text-foreground">
                {summaryPackage?.label ?? "—"}
              </dd>
            </div>
          </dl>
          {summaryPackage ? (
            <p className="mt-4 border-t border-zinc-800 pt-3 text-sm font-medium text-[#e829f1]">
              {summaryPackage.price}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
