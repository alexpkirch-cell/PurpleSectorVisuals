import type { Shoot } from "@/app/actions/shoots"

const MOCK_LEAD_PREFIX = "mock-"

export function isMockShoot(id: string) {
  return id.startsWith(MOCK_LEAD_PREFIX)
}

/**
 * A built-in demo lead that lives only in client state (never persisted).
 * Lets anyone click through "New Inquiry" -> "Confirm Lead & Generate Vault"
 * to preview how the CRM modal's UI progresses without touching real data.
 */
export function createMockTestLead(): Shoot {
  const now = new Date()
  const preferredDate = new Date(now)
  preferredDate.setDate(preferredDate.getDate() + 21)

  return {
    id: `${MOCK_LEAD_PREFIX}test-test`,
    client_name: "Test Test",
    client_email: "test@test.com",
    client_phone: "(555) 010-1234",
    shoot_type: "Senior Portrait Session",
    shoot_date: preferredDate.toISOString(),
    location: "Studio A",
    preferred_shooter: null,
    assigned_shooter: null,
    assigned_editor: null,
    status: "new_inquiry",
    base_price: "0",
    travel_fee: "0",
    is_paid: false,
    notes: "Demo lead — walk this card through \u201cConfirm Lead & Generate Vault\u201d to preview the CRM flow.",
    vault_access_code: "PS-DEMO",
    created_at: now.toISOString(),
    final_amount: null,
    settlement_items: null,
    vault_pin: null,
    vault_status: null,
    vault_contract_signed: null,
    vault_deposit_paid: null,
    vault_deposit_amount: null,
    vault_balance_paid: null,
    vault_balance_amount: null,
    vault_expires_at: null,
    vault_is_minor: null,
    vault_guardian_name: null,
    vault_guardian_relationship: null,
    vault_guardian_phone: null,
    vault_guardian_email: null,
  }
}
