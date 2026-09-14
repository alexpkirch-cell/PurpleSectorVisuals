"use client"

import { useState } from "react"
import { Camera, Check, Copy, KeyRound } from "lucide-react"
import Link from "next/link"

import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createShootInquiry } from "@/app/actions/shoots"

const SHOOT_TYPES = ["Portrait", "Event", "Automotive", "Product", "Brand", "Other"]
const SHOOTERS = ["Alex", "Gabe", "No Preference"]

export function ShootIntakeForm() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ vaultAccessCode: string } | null>(null)
  const [shootType, setShootType] = useState("")
  const [preferredShooter, setPreferredShooter] = useState("")
  const [copied, setCopied] = useState(false)

  async function handleSubmit(formData: FormData) {
    setError(null)
    setIsSubmitting(true)
    try {
      const response = await createShootInquiry({
        clientName: String(formData.get("clientName") ?? ""),
        clientEmail: String(formData.get("clientEmail") ?? ""),
        clientPhone: String(formData.get("clientPhone") ?? ""),
        shootType,
        shootDate: String(formData.get("shootDate") ?? "") || undefined,
        location: String(formData.get("location") ?? ""),
        preferredShooter,
        notes: String(formData.get("notes") ?? ""),
      })
      setResult(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function copyCode() {
    if (!result) return
    await navigator.clipboard.writeText(result.vaultAccessCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (result) {
    return (
      <div className="flex flex-col items-center gap-6 rounded-xl border border-border bg-card p-8 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Camera className="size-6" />
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="font-heading text-xl font-semibold text-foreground">Inquiry received</h2>
          <p className="text-sm text-muted-foreground">
            We&apos;ll follow up shortly to confirm details. Save your vault access code below &mdash;
            you&apos;ll use it with your email to check on your shoot and download photos later.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-border bg-accent/30 px-4 py-3">
          <span className="font-mono text-lg font-semibold tracking-wider text-foreground">
            {result.vaultAccessCode}
          </span>
          <Button type="button" variant="ghost" size="icon" onClick={copyCode} aria-label="Copy vault code">
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </Button>
        </div>

        <Link href="/shoot-vault" className={cn(buttonVariants(), "w-full")}>
          <KeyRound data-icon="inline-start" />
          Go to your vault
        </Link>
      </div>
    )
  }

  return (
    <form
      action={handleSubmit}
      className="flex flex-col gap-5 rounded-xl border border-border bg-card p-6 sm:p-8"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="clientName">Full name</Label>
          <Input id="clientName" name="clientName" required autoComplete="name" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="clientPhone">Phone</Label>
          <Input id="clientPhone" name="clientPhone" type="tel" autoComplete="tel" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="clientEmail">Email</Label>
        <Input id="clientEmail" name="clientEmail" type="email" required autoComplete="email" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="shootType">Shoot type</Label>
          <Select value={shootType} onValueChange={(value) => setShootType(value ?? "")} required>
            <SelectTrigger id="shootType">
              <SelectValue placeholder="Select a type" />
            </SelectTrigger>
            <SelectContent>
              {SHOOT_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="shootDate">Preferred date</Label>
          <Input id="shootDate" name="shootDate" type="date" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="location">Location</Label>
        <Textarea id="location" name="location" rows={2} placeholder="Where should we meet?" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="preferredShooter">Preferred shooter</Label>
        <Select value={preferredShooter} onValueChange={(value) => setPreferredShooter(value ?? "")}>
          <SelectTrigger id="preferredShooter">
            <SelectValue placeholder="No preference" />
          </SelectTrigger>
          <SelectContent>
            {SHOOTERS.map((shooter) => (
              <SelectItem key={shooter} value={shooter}>
                {shooter}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Mileage / travel notes</Label>
        <Textarea id="notes" name="notes" rows={3} placeholder="Anything else we should know?" />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={isSubmitting || !shootType}>
        {isSubmitting ? "Submitting…" : "Submit inquiry"}
      </Button>
    </form>
  )
}
