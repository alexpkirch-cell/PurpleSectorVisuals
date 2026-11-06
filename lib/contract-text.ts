/**
 * Stamped into every generated agreement. Unsigned agreements that predate the current terms (no marker) are rebuilt the
 * next time the client opens them; signed ones are never touched.
 */
export const CONTRACT_VERSION_MARKER = "psv-contract-v2"

export const LIABILITY_RELEASE_TEXT = `PURPLE SECTOR VISUALS — SERVICE AGREEMENT & MEDIA RELEASE

By signing below, the client ("Client") and Purple Sector Visuals ("Studio") agree to the following terms for the session described in this agreement. If the Client is signing for a group, a company, or a minor, the signer confirms they have the authority to bind everyone covered by the session.

1. SERVICES & DELIVERY. The Studio will photograph the session on the date and at the location stated above and will deliver the final edited gallery within the timeframe of the selected package. Delivery timelines may be affected by weather, location access, or circumstances beyond the Studio's control. The Studio chooses which images are edited and delivered and keeps full creative control over composition, editing style, and post-production.

2. LIMITATION OF LIABILITY. The Client releases the Studio, its photographers, editors, and affiliated crew from liability for injury, loss, or damage to persons or property occurring during the session, except in cases of gross negligence or willful misconduct. The Client is responsible for the safety of the people, animals, vehicles, and property the Client brings to the session and for any permission needed to photograph at the chosen location. To the fullest extent permitted by law, the Studio's total liability for any claim arising from this agreement is limited to the amount the Client has actually paid to the Studio under it, and the Studio is not liable for indirect, incidental, or consequential damages, including lost opportunities or the inability to recreate a one-time event. If images are lost or become unusable because of equipment failure, data corruption, or other causes outside the Studio's reasonable control, the Client's sole remedy is a reshoot where possible or a refund of the amounts paid.

3. COPYRIGHT & INTELLECTUAL PROPERTY. The Studio owns the copyright and all intellectual property rights in every image captured during the session, including raw and unedited files, outtakes, presets, and project files. Raw files are not part of the delivery unless the parties agree otherwise in writing. Once the contract is paid in full, the Client receives a non-exclusive, non-transferable, perpetual license to use the delivered final images for personal purposes, including sharing them digitally and on social media and making prints for personal display. Commercial, advertising, editorial, or resale use requires a separate written license from the Studio. The Client may not sell or sublicense the delivered images, or alter them in a way that misrepresents the Studio's work.

4. MEDIA RELEASE & PORTFOLIO USE. Unless the Client opts out in writing before the session date, the Studio may use unedited and edited images from the session in its portfolio, website, social media, and marketing and promotional materials. The Client's choice is recorded on this agreement.

5. PAYMENT TERMS. A retainer (the deposit stated in the payment schedule above) is due when this agreement is signed and is required to reserve the session date. The retainer is non-refundable once paid, because the Studio turns away other work to hold the date, and it is credited toward the total contract price. The remaining balance is due in full on or before the day of the session. Final galleries are released once the balance is paid in full, and the Studio may pause or end a session if an outstanding balance is not resolved.

6. CANCELLATION & RESCHEDULING. The Client may reschedule once with at least 72 hours' written notice; the retainer transfers to the new date if it falls within 90 days of the original booking, subject to the Studio's availability. Rescheduling with less than 72 hours' notice, rescheduling more than once, or choosing a date beyond 90 days forfeits the retainer. If the Client cancels, the retainer is forfeited, and any amount paid beyond it for services not yet performed is refunded. If the Client arrives more than 20 minutes late, the session may be shortened without a reduction in price, and a no-show forfeits all amounts paid. If the Studio must cancel or reschedule because of weather, illness, or an emergency, the Client may choose a new date at no charge or receive a full refund of all amounts paid.

7. ELECTRONIC SIGNATURE & RECORD. The Client agrees that typing their full legal name and drawing their signature is a legally binding electronic signature under the U.S. ESIGN Act and the Uniform Electronic Transactions Act. The Client acknowledges that the Studio records the date and time of signing, the Client's IP address, and device information, and keeps them with this agreement as a verification record.

8. GENERAL. This agreement is the entire agreement between the parties for this session and replaces any earlier discussions. It is governed by the laws of the State of Colorado. If any part of it is found unenforceable, the rest remains in effect. Changes must be made in writing and agreed to by both parties.

By typing your full legal name and signing below, you confirm that you have read, understood, and agree to these terms.`

export const MINOR_ADDENDUM_TEXT = `MINOR PARTICIPANT ADDENDUM

Because the subject of this session is under 18 years of age, a parent or legal guardian must review and countersign this agreement on the minor's behalf. By providing a guardian name and signature, the undersigned confirms they are the parent or legal guardian of the minor, have full legal authority to bind the minor to the terms above, and accept those terms on the minor's behalf.`

export const PORTFOLIO_GRANTED_TEXT = `PORTFOLIO USAGE: The client has granted Purple Sector Visuals permission to use session images for portfolio, marketing, and promotional purposes, per Section 4 (Media Release & Portfolio Use) above.`

export const PORTFOLIO_OPT_OUT_TEXT = `PORTFOLIO USAGE: The client has OPTED OUT of portfolio, marketing, and promotional usage of session images. Images from this session may not be used publicly.`

/**
 * Assembles the full contract body shown to the client and stored on the
 * `contracts` row, layering the minor addendum and the client's portfolio
 * usage choice onto the base service agreement text.
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
