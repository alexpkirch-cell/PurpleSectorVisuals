"use server"

import { createClient } from "@/lib/supabase/server"

export type BookingSubject = "automotive" | "sports" | "senior" | "headshots"
export type BookingCreator = "match" | "alex" | "gabe" | "dual"
export type BookingPackage = "standard" | "action" | "dual-build"

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

  const { error } = await supabase.from("booking_requests").insert({
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
  })

  if (error) {
    console.log("[v0] booking insert error", error.message)
    return {
      success: false,
      error: "Something went wrong submitting your request. Please try again.",
    }
  }

  return { success: true }
}
