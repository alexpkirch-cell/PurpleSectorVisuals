export type Discipline = "Sports" | "Automotive" | "Portraits" | "Events"

export const disciplines: {
  name: Discipline
  description: string
  aspect: string
}[] = [
  {
    name: "Sports",
    description: "Peak action, frozen at the decisive moment.",
    aspect: "16:9 Slot",
  },
  {
    name: "Automotive",
    description: "Steel, light, and motion rendered with intent.",
    aspect: "4:5 Slot",
  },
  {
    name: "Portraits",
    description: "Character studies with cinematic depth.",
    aspect: "4:5 Portrait Slot",
  },
  {
    name: "Events",
    description: "Every atmosphere, documented in full fidelity.",
    aspect: "16:9 Slot",
  },
]

export interface GalleryItem {
  id: string
  category: Discipline
  title: string
  creator: "Alex" | "Gabe"
  aspect: string
}

export const galleryItems: GalleryItem[] = [
  { id: "g1", category: "Sports", title: "Apex Sprint", creator: "Alex", aspect: "16:9 Slot" },
  { id: "g2", category: "Automotive", title: "Night Circuit", creator: "Gabe", aspect: "4:5 Slot" },
  { id: "g3", category: "Portraits", title: "Studio Light", creator: "Alex", aspect: "4:5 Portrait Slot" },
  { id: "g4", category: "Events", title: "Paddock Pass", creator: "Gabe", aspect: "4:5 Slot" },
  { id: "g5", category: "Sports", title: "Full Throttle", creator: "Gabe", aspect: "4:5 Slot" },
  { id: "g6", category: "Automotive", title: "Chrome & Rain", creator: "Alex", aspect: "4:5 Slot" },
  { id: "g7", category: "Portraits", title: "Off Track", creator: "Gabe", aspect: "4:5 Portrait Slot" },
  { id: "g8", category: "Events", title: "Grid Walk", creator: "Alex", aspect: "4:5 Slot" },
  { id: "g9", category: "Sports", title: "Braking Point", creator: "Alex", aspect: "4:5 Slot" },
  { id: "g10", category: "Automotive", title: "Garage Hour", creator: "Gabe", aspect: "4:5 Slot" },
  { id: "g11", category: "Portraits", title: "Visor Up", creator: "Alex", aspect: "4:5 Portrait Slot" },
  { id: "g12", category: "Events", title: "Podium Spray", creator: "Gabe", aspect: "4:5 Slot" },
]

export const navLinks = [
  { label: "About", href: "/" },
  { label: "Portfolio", href: "/work" },
  { label: "Packages", href: "/services" },
  { label: "Contact", href: "/contact" },
]
