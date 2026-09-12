import { HeroSection } from "@/components/home/hero-section"
import { CoreIdentitySection } from "@/components/home/core-identity-section"
import { DualSplitSection } from "@/components/home/dual-split-section"
import { DisciplinesSection } from "@/components/home/disciplines-section"
import { getSiteSlots } from "@/lib/site-slots"

export default async function Page() {
  const overrides = await getSiteSlots()

  return (
    <>
      <HeroSection />
      <CoreIdentitySection overrides={overrides} />
      <DualSplitSection overrides={overrides} />
      <DisciplinesSection overrides={overrides} />
    </>
  )
}
