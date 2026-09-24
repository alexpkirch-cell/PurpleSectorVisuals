export type LeadSource = "psv_house" | "personal_alex" | "personal_gabe"
export type ShootingScenario = "solo" | "lead_second" | "two_equal"
export type EditingScenario = "single" | "split"
export type Photographer = "Alex" | "Gabe"

export interface RevenueSplitInput {
  grossTotal: number
  leadSource: LeadSource
  shootingScenario: ShootingScenario
  soloShooter: Photographer
  leadShooter: Photographer
  editingScenario: EditingScenario
  singleEditor: Photographer
}

export interface RevenueSplitLine {
  label: string
  recipient: string
  amount: number
}

export interface RevenueSplitBreakdown {
  grossTotal: number
  /** On-Site Shooting Pool — locked at 40% of gross regardless of crew scenario. */
  shootingPool: RevenueSplitLine[]
  /** Post-Production Pool — locked at 20% of gross regardless of crew scenario. */
  postProductionPool: RevenueSplitLine[]
  /** Lead Origination — locked at 10% of gross. Routes to PSV House or the originating photographer. */
  leadOrigination: RevenueSplitLine[]
  /** The House / PSV Reserve — strictly locked at 30% of gross on every booking. */
  houseReserve: RevenueSplitLine[]
}

function otherPhotographer(name: Photographer): Photographer {
  return name === "Alex" ? "Gabe" : "Alex"
}

/**
 * Computes the 4-bucket revenue split (40% shooting / 20% editing / 10% lead
 * origination / 30% house reserve) for a shoot's gross contract total.
 * A roster photographer who solo-shoots, single-edits, and originated the
 * lead can earn up to 70% of the booking (40 + 20 + 10).
 */
export function calculateFourBucketSplit(input: RevenueSplitInput): RevenueSplitBreakdown {
  const grossTotal = Number.isFinite(input.grossTotal) && input.grossTotal > 0 ? input.grossTotal : 0

  let shootingPool: RevenueSplitLine[]
  if (input.shootingScenario === "solo") {
    shootingPool = [{ label: "Solo Shooter (40%)", recipient: input.soloShooter, amount: grossTotal * 0.4 }]
  } else if (input.shootingScenario === "lead_second") {
    shootingPool = [
      { label: "Lead Shooter (25%)", recipient: input.leadShooter, amount: grossTotal * 0.25 },
      { label: "2nd Shooter (15%)", recipient: otherPhotographer(input.leadShooter), amount: grossTotal * 0.15 },
    ]
  } else {
    shootingPool = [
      { label: "Shooter (20%)", recipient: "Alex", amount: grossTotal * 0.2 },
      { label: "Shooter (20%)", recipient: "Gabe", amount: grossTotal * 0.2 },
    ]
  }

  const postProductionPool: RevenueSplitLine[] =
    input.editingScenario === "single"
      ? [{ label: "Single Editor (20%)", recipient: input.singleEditor, amount: grossTotal * 0.2 }]
      : [
          { label: "Editor (10%)", recipient: "Alex", amount: grossTotal * 0.1 },
          { label: "Editor (10%)", recipient: "Gabe", amount: grossTotal * 0.1 },
        ]

  const leadOrigination: RevenueSplitLine[] =
    input.leadSource === "psv_house"
      ? [{ label: "PSV House Inbound (10%)", recipient: "PSV House", amount: grossTotal * 0.1 }]
      : [
          {
            label: "Origination Bonus (10%)",
            recipient: input.leadSource === "personal_alex" ? "Alex" : "Gabe",
            amount: grossTotal * 0.1,
          },
        ]

  const houseReserve: RevenueSplitLine[] = [
    { label: "PSV Reserve (30%)", recipient: "PSV House", amount: grossTotal * 0.3 },
  ]

  return { grossTotal, shootingPool, postProductionPool, leadOrigination, houseReserve }
}

/** Aggregates every line of a breakdown into a total payout per recipient. */
export function totalPayoutByRecipient(breakdown: RevenueSplitBreakdown): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const line of [
    ...breakdown.shootingPool,
    ...breakdown.postProductionPool,
    ...breakdown.leadOrigination,
    ...breakdown.houseReserve,
  ]) {
    totals[line.recipient] = (totals[line.recipient] ?? 0) + line.amount
  }
  return totals
}
