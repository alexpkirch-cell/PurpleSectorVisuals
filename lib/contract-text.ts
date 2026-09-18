export const LIABILITY_RELEASE_TEXT = `PURPLE SECTOR VISUALS — SHOOT LIABILITY RELEASE & IMAGE USAGE AGREEMENT

By signing below, the client acknowledges and agrees to the following terms:

1. RELEASE OF LIABILITY. The client releases Purple Sector Visuals, its photographers, and affiliated crew from any liability for injury, loss, or damage to persons or property occurring during the scheduled session, except in cases of gross negligence.

2. IMAGE USAGE. Purple Sector Visuals retains the right to use unedited and edited images from this session for portfolio, marketing, and promotional purposes unless a written opt-out is provided prior to the session date.

3. RESCHEDULING & CANCELLATION. Deposits are non-refundable but fully transferable to a rescheduled date within 90 days of the original booking, subject to availability.

4. DELIVERY. Final edited galleries are delivered within the timeframe stated in the selected package. Delivery timelines may be affected by weather, location access, or extenuating circumstances beyond our control.

5. PAYMENT. The remaining balance is due in full on or before the day of the scheduled session. Sessions may be paused or ended if outstanding balances are not resolved.

By typing your full legal name below, you are providing a legally binding electronic signature acknowledging you have read, understood, and agree to these terms.`

export const MINOR_ADDENDUM_TEXT = `MINOR PARTICIPANT ADDENDUM

Because the subject of this session is under 18 years of age, a parent or legal guardian must review and countersign this agreement on the minor's behalf. By providing a guardian name and signature, the undersigned confirms they are the parent or legal guardian of the minor, have full legal authority to bind the minor to the terms above, and accept those terms on the minor's behalf.`

export const PORTFOLIO_GRANTED_TEXT = `PORTFOLIO USAGE: The client has granted Purple Sector Visuals permission to use session images for portfolio, marketing, and promotional purposes, per Section 2 above.`

export const PORTFOLIO_OPT_OUT_TEXT = `PORTFOLIO USAGE: The client has OPTED OUT of portfolio, marketing, and promotional usage of session images. Images from this session may not be used publicly.`

/**
 * Assembles the full contract body shown to the client and stored on the
 * `contracts` row, layering the minor addendum and the client's portfolio
 * usage choice onto the base liability release text.
 */
export function buildContractBody({
  isMinor,
  portfolioOptOut,
}: {
  isMinor: boolean
  portfolioOptOut: boolean
}) {
  const sections = [LIABILITY_RELEASE_TEXT]
  if (isMinor) {
    sections.push(MINOR_ADDENDUM_TEXT)
  }
  sections.push(portfolioOptOut ? PORTFOLIO_OPT_OUT_TEXT : PORTFOLIO_GRANTED_TEXT)
  return sections.join("\n\n")
}
