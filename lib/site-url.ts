export const PUBLIC_SITE_ORIGIN = "https://purplesectorvisuals.com"

export const CLIENT_VAULT_LOGIN_URL = `${PUBLIC_SITE_ORIGIN}/vault`

export function clientVaultUrl(pin: string) {
  return `${PUBLIC_SITE_ORIGIN}/vault/${encodeURIComponent(pin)}`
}
