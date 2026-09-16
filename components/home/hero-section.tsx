import type { SiteTextOverrides } from "@/lib/site-slots"

import { HeroCarousel3D } from "@/components/home/hero-carousel-3d"

export function HeroSection({ text: _text }: { text: SiteTextOverrides }) {
  return <HeroCarousel3D />
}
