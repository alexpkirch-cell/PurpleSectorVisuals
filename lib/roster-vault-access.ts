import "server-only"

import { sql } from "@/lib/db"

export type RosterBillingMode = "all_inclusive" | "parent_pay" | "prepaid_comped"
export type VaultExperience = "full_client_vault" | "gallery_only"

export type RosterTeamBilling = {
  mode: RosterBillingMode
  experience: VaultExperience
  /** The team's second 50% is received (set by an admin). Only meaningful for all_inclusive teams. */
  balancePaid: boolean
}

export type RosterPhotoKind = "player" | "team"

export async function getRosterTeamBilling(teamId: string): Promise<RosterTeamBilling> {
  const { rows } = await sql<{
    vault_billing_mode: RosterBillingMode
    vault_experience: VaultExperience
    balance_paid: boolean
  }>`
    SELECT vault_billing_mode, vault_experience, balance_paid
    FROM public.roster_vault_teams WHERE id = ${teamId} LIMIT 1
  `
  const team = rows[0]
  return {
    mode: team?.vault_billing_mode === "all_inclusive" || team?.vault_billing_mode === "prepaid_comped" ? team.vault_billing_mode : "parent_pay",
    experience: team?.vault_experience === "full_client_vault" ? "full_client_vault" : "gallery_only",
    balancePaid: Boolean(team?.balance_paid),
  }
}

/** Gallery-Only and Prepaid/Comped teams bypass digital payment prompts; buyout teams unlock after their balance is paid. */
export function teamDownloadsIncluded(billing: RosterTeamBilling) {
  return billing.experience === "gallery_only" || billing.mode === "prepaid_comped" || (billing.mode === "all_inclusive" && billing.balancePaid)
}

/** True when this parent session bought the full digital bundle for the player (a paid tier order). */
export async function hasPaidPlayerBundle(sessionId: string, teamId: string, playerId: string) {
  const { rows } = await sql<{ id: string }>`
    SELECT id FROM public.roster_vault_orders
    WHERE buyer_session_id = ${sessionId} AND team_id = ${teamId} AND player_id = ${playerId} AND status = 'paid'
    LIMIT 1
  `
  return Boolean(rows[0])
}

/** Ids of photos this parent session bought individually. */
export async function listPaidPhotoIds(sessionId: string, kind: RosterPhotoKind) {
  const { rows } = await sql<{ photo_id: string }>`
    SELECT photo_id FROM public.roster_vault_photo_orders
    WHERE buyer_session_id = ${sessionId} AND photo_kind = ${kind} AND status = 'paid'
  `
  return new Set(rows.map((row) => row.photo_id))
}
