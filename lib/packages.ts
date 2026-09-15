export const PACKAGE_CATEGORIES = ["Portraits", "Automotive", "Athletics", "Events"] as const

export type PackageCategory = (typeof PACKAGE_CATEGORIES)[number]

export interface AddOn {
  id: string
  name: string
  price: number
}

export interface ServicePackage {
  id: string
  category: PackageCategory
  title: string
  base_price: string
  duration: string | null
  deliverables: string[]
  add_ons: AddOn[]
  is_active: boolean
  created_at: string
}
