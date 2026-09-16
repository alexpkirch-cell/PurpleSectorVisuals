"use server"

import { createClient } from "@/lib/supabase/server"
import { createShootInquiry } from "@/app/actions/shoots"

export type BookingSubject = "automotive" | "sports" | "senior" | "headshots" | "event"
export type BookingCreator = "match" | "alex" | "gabe" | "dual"
export type BookingPackage = "standard" | "action" | "dual-build"

export interface SelectedAddOn {
  id: string
  name: string
  price: number
}

export interface BookingSubmission {
  firstName: string
  lastName: string
  email: string
  phone: string
  preferredDate: string
  location: string
  subject: BookingSubject
  creator: BookingCreator
  package: BookingPackage
  brief: string
  instagramHandle: string
  locationJump: boolean
  printPackage: boolean
  packageId?: string | null
  selectedAddOns?: SelectedAddOn[]
}

export async function submitBooking(
  submission: BookingSubmission
): Promise<{ success: true } | { success: false; error: string }> {
  const {
    firstName,
    lastName,
    email,
    phone,
    preferredDate,
    location,
    subject,
    creator,
    package: pkg,
    brief,
    instagramHandle,
    locationJump,
    printPackage,
    packageId,
    selectedAddOns,
  } = submission

  if (
    !firstName.trim() ||
    !lastName.trim() ||
    !email.trim() ||
    !phone.trim() ||
    !preferredDate.trim() ||
    !location.trim() ||
    !subject ||
    !creator ||
    !pkg
  ) {
    return { success: false, error: "Please fill in all required fields." }
  }

  const supabase = await createClient()

  // Keep the raw submission for reference alongside the pipeline record created below.
  const parsedDate = new Date(preferredDate.trim())
  const requestedDate = Number.isNaN(parsedDate.getTime())
    ? null
    : parsedDate.toISOString().slice(0, 10)

  const { data: inserted, error } = await supabase
    .from("booking_requests")
    .insert({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      preferred_date: preferredDate.trim(),
      location: location.trim(),
      subject,
      creator,
      package: pkg,
      brief: brief.trim() || null,
      instagram_handle: instagramHandle.trim() || null,
      location_jump: locationJump,
      print_package: printPackage,
      package_id: packageId || null,
      selected_addons: selectedAddOns ?? [],
      requested_date: requestedDate,
      status: "Pending",
    })
    .select("id")
    .single()

  if (error) {
    console.log("[v0] booking insert error", error.message)
    return {
      success: false,
      error: "Something went wrong submitting your request. Please try again.",
    }
  }

  const noteLines = [
    `Package: ${pkg}`,
    instagramHandle.trim() ? `Instagram: @${instagramHandle.trim()}` : null,
    locationJump ? "Add-on: Location jump" : null,
    printPackage ? "Add-on: Print package" : null,
    brief.trim() ? `Brief: ${brief.trim()}` : null,
  ].filter(Boolean)

  try {
    // Surface every new booking as a card in the New Inquiry column so nothing
    // submitted from the public Contact form is missed by the admin pipeline.
    const { shootId } = await createShootInquiry({
      clientName: `${firstName.trim()} ${lastName.trim()}`,
      clientEmail: email.trim(),
      clientPhone: phone.trim(),
      shootType: subject,
      shootDate: preferredDate.trim(),
      location: location.trim(),
      preferredShooter: creator,
      notes: noteLines.join("\n"),
    })

    // Link the pipeline card back to this request so approving it (dragging
    // into "Vault Created") can generate the client's PIN vault.
    if (inserted?.id) {
      await supabase.from("booking_requests").update({ shoot_id: shootId }).eq("id", inserted.id)
    }
  } catch (shootError) {
    console.log(
      "[v0] failed to create pipeline shoot from booking",
      shootError instanceof Error ? shootError.message : shootError,
    )
    // The booking request itself was saved successfully above, so we still
    // report success to the client rather than blocking their submission.
  }

  return { success: true }
}
