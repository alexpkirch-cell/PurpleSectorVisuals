export type PackageTier = "Base" | "Standard"

export const PACKAGE_PRICES: Record<PackageTier, number> = {
  Base: 225,
  Standard: 325,
}

export interface AddonOption {
  id: string
  label: string
  amount: number
}

export const ADDON_OPTIONS: AddonOption[] = [
  { id: "extra_time", label: "Extra Time", amount: 75 },
  { id: "additional_locations", label: "Additional Locations", amount: 50 },
  { id: "usb_raw", label: "USB RAW Delivery", amount: 40 },
]

// Placeholder studio roster for team assignment until a dedicated staff table exists.
export const STUDIO_SHOOTERS = ["Alex", "Gabe", "Jordan", "Maya"]
export const STUDIO_EDITORS = ["Gabe", "Priya", "Sam"]
