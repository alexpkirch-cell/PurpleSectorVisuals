export type Discipline = "Sports" | "Automotive" | "Portraits" | "Events"

export const disciplines: {
  name: Discipline
  description: string
  image: string
}[] = [
  {
    name: "Sports",
    description: "Peak action, frozen at the decisive moment.",
    image: "/images/discipline-sports.png",
  },
  {
    name: "Automotive",
    description: "Steel, light, and motion rendered with intent.",
    image: "/images/discipline-automotive.png",
  },
  {
    name: "Portraits",
    description: "Character studies with cinematic depth.",
    image: "/images/discipline-portraits.png",
  },
  {
    name: "Events",
    description: "Every atmosphere, documented in full fidelity.",
    image: "/images/discipline-events.png",
  },
]

export interface GalleryItem {
  id: string
  category: Discipline
  title: string
  creator: "Alex" | "Gabe"
  image: string
}

export const galleryItems: GalleryItem[] = [
  { id: "g1", category: "Sports", title: "Apex Sprint", creator: "Alex", image: "/images/gallery-sports-1.png" },
  { id: "g2", category: "Automotive", title: "Night Circuit", creator: "Gabe", image: "/images/gallery-automotive-1.png" },
  { id: "g3", category: "Portraits", title: "Studio Light", creator: "Alex", image: "/images/gallery-portrait-1.png" },
  { id: "g4", category: "Events", title: "Paddock Pass", creator: "Gabe", image: "/images/gallery-events-1.png" },
  { id: "g5", category: "Sports", title: "Full Throttle", creator: "Gabe", image: "/images/gallery-sports-2.png" },
  { id: "g6", category: "Automotive", title: "Chrome & Rain", creator: "Alex", image: "/images/gallery-automotive-2.png" },
  { id: "g7", category: "Portraits", title: "Off Track", creator: "Gabe", image: "/images/gallery-portrait-2.png" },
  { id: "g8", category: "Events", title: "Grid Walk", creator: "Alex", image: "/images/gallery-events-2.png" },
  { id: "g9", category: "Sports", title: "Braking Point", creator: "Alex", image: "/images/gallery-sports-3.png" },
  { id: "g10", category: "Automotive", title: "Garage Hour", creator: "Gabe", image: "/images/gallery-automotive-3.png" },
  { id: "g11", category: "Portraits", title: "Visor Up", creator: "Alex", image: "/images/gallery-portrait-3.png" },
  { id: "g12", category: "Events", title: "Podium Spray", creator: "Gabe", image: "/images/gallery-events-3.png" },
]

export const navLinks = [
  { label: "Work", href: "/work" },
  { label: "Alex", href: "/alex" },
  { label: "Gabe", href: "/gabe" },
  { label: "Packages", href: "/services" },
  { label: "Contact", href: "/contact" },
]
