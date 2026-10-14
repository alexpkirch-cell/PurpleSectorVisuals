"use client"

import { Builder } from "@builder.io/react"

import { BookingButton } from "@/components/builder/booking-button"

Builder.registerComponent(BookingButton, {
  name: "BookingButton",
  friendlyName: "Booking Button",
  description: "Sends visitors into the booking pipeline (/book). Optionally preselects a shooter.",
  inputs: [
    {
      name: "label",
      type: "text",
      defaultValue: "Book a shoot",
    },
    {
      name: "shooterId",
      friendlyName: "Shooter ID",
      type: "text",
      helperText: "Optional roster member ID to preselect on the booking form.",
    },
    {
      name: "variant",
      type: "text",
      enum: ["default", "outline", "secondary", "ghost"],
      defaultValue: "default",
    },
    {
      name: "size",
      type: "text",
      enum: ["default", "sm", "lg"],
      defaultValue: "lg",
    },
  ],
})
