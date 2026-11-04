/** Private bucket holding delivered client photos; only admins and the server can read it directly. */
export const VAULT_PHOTOS_BUCKET = "gallery-photos"

/** Longest edge of the grid preview generated in the admin's browser at upload time. */
export const VAULT_THUMB_MAX_EDGE = 1600

export function vaultPhotoPath(vaultId: string, id: string, extension: string) {
  return `vault-photos/${vaultId}/${id}.${extension}`
}

export function vaultThumbPath(vaultId: string, id: string) {
  return `vault-photos/${vaultId}/thumbs/${id}.jpg`
}
