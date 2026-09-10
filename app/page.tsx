import { HeroSection } from "@/components/home/hero-section"
import { CoreIdentitySection } from "@/components/home/core-identity-section"
import { DualSplitSection } from "@/components/home/dual-split-section"
import { DisciplinesSection } from "@/components/home/disciplines-section"

export default function Page() {
  return (
    <>
      <HeroSection />
      <CoreIdentitySection />
      <DualSplitSection />
      <DisciplinesSection />
    </>
  )
}
