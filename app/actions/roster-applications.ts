"use server"

import { createAdminClient } from "@/lib/supabase/server"

export type RosterApplicationResult = { ok: true } | { ok: false; error: string }

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const clean = (value: FormDataEntryValue | null, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : ""

/** Public endpoint for the homepage form. Inserts with the service role; the table has RLS on and no public policies. */
export async function submitRosterApplication(formData: FormData): Promise<RosterApplicationResult> {
  // Honeypot: real visitors never see or fill this field.
  if (clean(formData.get("website"), 200)) return { ok: true }

  const name = clean(formData.get("name"), 120)
  const email = clean(formData.get("email"), 200).toLowerCase()
  const portfolioLink = clean(formData.get("portfolio_link"), 300)
  const instagram = clean(formData.get("instagram"), 80).replace(/^@/, "")

  if (!name) return { ok: false, error: "Please add your name." }
  if (!EMAIL_PATTERN.test(email)) return { ok: false, error: "Please enter a valid email." }
  if (!portfolioLink && !instagram) {
    return { ok: false, error: "Share a portfolio link or an Instagram handle so we can see your work." }
  }

  const supabase = createAdminClient()

  const { count } = await supabase
    .from("roster_applications")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .eq("status", "new")
  if ((count ?? 0) > 0) return { ok: true }

  const { error } = await supabase.from("roster_applications").insert({
    name,
    email,
    portfolio_link: portfolioLink || null,
    instagram: instagram || null,
  })
  if (error) return { ok: false, error: "Something went wrong. Please try again in a moment." }

  return { ok: true }
}
