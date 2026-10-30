"use client"

import { useState, useTransition } from "react"
import { Check, ExternalLink, Loader2, MapPin } from "lucide-react"
import { toast } from "sonner"

import { submitPrepNotes } from "@/app/actions/vault-portal"
import { Button, buttonVariants } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { prepGuideFor } from "@/lib/vault-prep-guides"

interface PrepTabProps {
  vaultId: string
  category: string | null
  location: string | null
  shootDateLabel: string | null
  initialMustHaveShots: string | null
  initialMoodBoardLinks: string | null
  prepSubmitted: boolean
}

export function PrepTab({
  vaultId,
  category,
  location,
  shootDateLabel,
  initialMustHaveShots,
  initialMoodBoardLinks,
  prepSubmitted,
}: PrepTabProps) {
  const guide = prepGuideFor(category)
  const [mustHaveShots, setMustHaveShots] = useState(initialMustHaveShots ?? "")
  const [moodBoardLinks, setMoodBoardLinks] = useState(initialMoodBoardLinks ?? "")
  const [submitted, setSubmitted] = useState(prepSubmitted)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const query = location ? encodeURIComponent(location) : null

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await submitPrepNotes(vaultId, { mustHaveShots, moodBoardLinks })
      if (!result.success) {
        setError(result.error ?? "Something went wrong.")
        return
      }
      setSubmitted(true)
      toast.success("Thanks! Your shot list has been sent to your photographer.")
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="location-heading" className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="location-heading" className="flex items-center gap-2 font-heading text-base font-medium text-foreground">
              <MapPin className="h-5 w-5 text-primary" />
              Shoot Location
            </h2>
            <p className="text-sm text-muted-foreground">
              {location ?? "Your exact location will appear here once it's confirmed."}
              {shootDateLabel && ` \u00b7 ${shootDateLabel}`}
            </p>
          </div>
          {query && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${query}`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <ExternalLink className="h-4 w-4" />
              Open in Google Maps
            </a>
          )}
        </div>

        {query ? (
          <iframe
            title={`Map of ${location}`}
            src={`https://maps.google.com/maps?q=${query}&z=14&output=embed`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="h-72 w-full rounded-xl border border-border bg-background"
          />
        ) : (
          <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border bg-background text-sm text-muted-foreground">
            Map unavailable until a location is saved
          </div>
        )}
      </section>

      <section aria-labelledby="guidelines-heading" className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
        <h2 id="guidelines-heading" className="font-heading text-base font-medium text-foreground">
          {guide.title}
        </h2>
        <ul className="flex flex-col gap-3 text-sm text-muted-foreground">
          {guide.tips.map((tip) => (
            <li key={tip} className="flex gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </section>

      <form
        onSubmit={handleSubmit}
        aria-labelledby="shots-heading"
        className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5"
      >
        <div className="flex flex-col gap-1">
          <h2 id="shots-heading" className="font-heading text-base font-medium text-foreground">
            Must-Have Shots &amp; Mood Board
          </h2>
          <p className="text-sm text-muted-foreground">
            Tell us what you can&apos;t leave without, and share any inspiration. You can update this until the day of
            the shoot.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="mustHaveShots" className="text-sm text-muted-foreground">
            Must-have shots
          </Label>
          <Textarea
            id="mustHaveShots"
            value={mustHaveShots}
            onChange={(e) => setMustHaveShots(e.target.value)}
            placeholder="e.g. Rolling shot on the canyon road, close-up of the wheels, group photo with the whole crew"
            rows={4}
            maxLength={2000}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="moodBoardLinks" className="text-sm text-muted-foreground">
            Mood board links
          </Label>
          <Textarea
            id="moodBoardLinks"
            value={moodBoardLinks}
            onChange={(e) => setMoodBoardLinks(e.target.value)}
            placeholder="Paste Pinterest, Instagram or Google Drive links, one per line"
            rows={3}
            maxLength={2000}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" disabled={pending || (!mustHaveShots.trim() && !moodBoardLinks.trim())}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : submitted ? (
            "Update Shot List"
          ) : (
            "Send to My Photographer"
          )}
        </Button>
      </form>
    </div>
  )
}
