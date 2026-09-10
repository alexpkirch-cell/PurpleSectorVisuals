"use client"

import { useSearchParams } from "next/navigation"
import { useState, type FormEvent } from "react"
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
import { Button } from "@/components/ui/button"

const categories = ["Sports", "Automotive", "Portraits", "Events"]
const shooters = ["Studio Match", "Alex", "Gabe", "Both"]

export function BookingForm() {
  const searchParams = useSearchParams()
  const initialShooter = searchParams.get("shooter")
  const initialTier = searchParams.get("tier")

  const [shooterPreference, setShooterPreference] = useState(
    shooters.includes(initialShooter ?? "") ? initialShooter! : ""
  )
  const [category, setCategory] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)

    await new Promise((resolve) => setTimeout(resolve, 700))

    toast.success("Request sent", {
      description: "We'll follow up within 24 hours to confirm your shoot.",
    })

    setSubmitting(false)
    event.currentTarget.reset()
    setShooterPreference("")
    setCategory("")
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <FieldGroup>
        {initialTier ? (
          <div className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-foreground">
            Requesting the <span className="font-medium">{initialTier}</span>{" "}
            package
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="name">Name</FieldLabel>
            <Input id="name" name="name" placeholder="Jordan Rivera" required />
          </Field>
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
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
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="date">Project Date</FieldLabel>
            <Input id="date" name="date" type="date" required />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="category">Category</FieldLabel>
            <Select
              value={category}
              onValueChange={(value) => setCategory(value ?? "")}
              name="category"
            >
              <SelectTrigger id="category" className="w-full">
                <SelectValue placeholder="Select a category" />
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
            <FieldLabel htmlFor="shooter">Shooter Preference</FieldLabel>
            <Select
              value={shooterPreference}
              onValueChange={(value) => setShooterPreference(value ?? "")}
              name="shooter"
            >
              <SelectTrigger id="shooter" className="w-full">
                <SelectValue placeholder="Select a preference" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {shooters.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="notes">Project Notes</FieldLabel>
          <Input
            id="notes"
            name="notes"
            placeholder="Location, timing, or anything else we should know"
          />
          <FieldDescription>Optional, but it helps us prep.</FieldDescription>
        </Field>

        <Button
          type="submit"
          disabled={submitting}
          className="mt-2 w-full rounded-full bg-primary py-6 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {submitting ? "Sending..." : "Send Booking Request"}
          {!submitting && <ArrowUpRight className="size-4" data-icon="inline-end" />}
        </Button>
      </FieldGroup>
    </form>
  )
}
