import { HeroSection } from "@/components/home/hero-section"
import { CoreIdentitySection } from "@/components/home/core-identity-section"
import { DualSplitSection } from "@/components/home/dual-split-section"
import { DisciplinesSection } from "@/components/home/disciplines-section"
import { JoinTheRosterSection } from "@/components/home/join-the-roster-section"
import { getSiteSlots, getSiteText } from "@/lib/site-slots"

export async function HomePage() {
  const [overrides, text] = await Promise.all([getSiteSlots(), getSiteText()])

  return (
    <>
      <HeroSection text={text} />
      <CoreIdentitySection />
      <DisciplinesSection overrides={overrides} />
      <DualSplitSection overrides={overrides} />
      <JoinTheRosterSection />
    </>
  )
}
