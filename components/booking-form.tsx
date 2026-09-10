"use client"

import { useSearchParams } from "next/navigation"
import { useRef, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { ArrowUpRight } from "lucide-react"

import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const categories = ["Sports", "Automotive", "Portraits", "Events"]
const shooters = ["Studio Match", "Alex", "Gabe", "Dual Coverage"] as const

const focusClasses =
  "focus-visible:border-[#e829f1] focus-visible:ring-[#e829f1]/20"

export function BookingForm() {
  const searchParams = useSearchParams()
  const initialShooter = searchParams.get("shooter")
  const initialTier = searchParams.get("tier")

  const [shooterPreference, setShooterPreference] = useState<string>(() => {
    if (initialShooter && (shooters as readonly string[]).includes(initialShooter)) {
      return initialShooter
    }
    return ""
  })
  const [category, setCategory] = useState("")
  const [location, setLocation] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)

    await new Promise((resolve) => setTimeout(resolve, 700))

    toast.success("Request sent", {
      description: "We'll follow up within 24 hours to confirm your shoot.",
    })

    setSubmitting(false)
    formRef.current?.reset()
    setShooterPreference("")
    setCategory("")
    setLocation("")
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="w-full">
      <FieldGroup>
        {initialTier ? (
          <div className="rounded-2xl border border-[#e829f1]/30 bg-[#e829f1]/10 px-4 py-3 text-sm text-foreground">
            Requesting the <span className="font-medium">{initialTier}</span>{" "}
            package
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="name">Client Name</FieldLabel>
            <Input
              id="name"
              name="name"
              placeholder="Jordan Rivera"
              required
              className={focusClasses}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              className={focusClasses}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="phone">Phone</FieldLabel>
            <Input
              id="phone"
              name="phone"
              type="tel"
              placeholder="(555) 010-2020"
              className={focusClasses}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="date">Event Date</FieldLabel>
            <Input
              id="date"
              name="date"
              type="date"
              required
              className={focusClasses}
            />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="location">Location</FieldLabel>
          <Input
            id="location"
            name="location"
            placeholder="Track, studio, or venue address"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            className={focusClasses}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="category">Service</FieldLabel>
          <Select
            value={category}
            onValueChange={(value) => setCategory(value ?? "")}
            name="category"
          >
            <SelectTrigger id="category" className={cn("w-full", focusClasses)}>
              <SelectValue placeholder="Select a service" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel htmlFor="shooter">Artist Preference</FieldLabel>
          <ToggleGroup
            value={shooterPreference ? [shooterPreference] : []}
            onValueChange={(value) => setShooterPreference(value[0] ?? "")}
            variant="outline"
            className="w-full flex-wrap"
          >
            {shooters.map((s) => (
              <ToggleGroupItem
                key={s}
                value={s}
                className="flex-1 rounded-full border-zinc-800 text-zinc-400 aria-pressed:border-[#e829f1] aria-pressed:bg-[#e829f1] aria-pressed:text-white"
              >
                {s}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <input type="hidden" name="shooter" value={shooterPreference} />
        </Field>

        <Field>
          <FieldLabel htmlFor="notes">Project Vision</FieldLabel>
          <Input
            id="notes"
            name="notes"
            placeholder="Location, timing, or anything else we should know"
            className={focusClasses}
          />
          <FieldDescription>Optional, but it helps us prep.</FieldDescription>
        </Field>

        <Button
          type="submit"
          disabled={submitting}
          className="mt-2 w-full rounded-full bg-[#e829f1] py-6 text-sm font-medium text-white hover:bg-[#e829f1]/90"
        >
          {submitting ? "Sending..." : "Send Booking Request"}
          {!submitting && <ArrowUpRight className="size-4" data-icon="inline-end" />}
        </Button>
      </FieldGroup>
    </form>
  )
}

