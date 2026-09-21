import { HeroSection } from "@/components/home/hero-section"
import { CoreIdentitySection } from "@/components/home/core-identity-section"
import { DualSplitSection } from "@/components/home/dual-split-section"
import { DisciplinesSection } from "@/components/home/disciplines-section"
import { MeetTheTeam } from "@/components/home/meet-the-team"
import { getSiteSlots, getSiteText } from "@/lib/site-slots"

export default async function Page() {
  const [overrides, text] = await Promise.all([getSiteSlots(), getSiteText()])

  return (
    <>
      <HeroSection text={text} />
      <CoreIdentitySection overrides={overrides} />
      <DualSplitSection overrides={overrides} />
      <DisciplinesSection overrides={overrides} />
      <MeetTheTeam />
    </>
  )
}
