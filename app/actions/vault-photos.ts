"use server"

import { revalidatePath } from "next/cache"

import { sql } from "@/lib/db"
import { requireAdmin } from "@/lib/require-admin"
import { createAdminClient } from "@/lib/supabase/server"
import { canViewDelivery } from "@/lib/vault-delivery"
import { VAULT_PHOTOS_BUCKET } from "@/lib/vault-photo-storage"

const SIGNED_URL_TTL_SECONDS = 60 * 60
const MAX_FILE_NAME_LENGTH = 255

export interface VaultPhotoView {
  id: string
  fileName: string
  width: number | null
  height: number | null
  sizeBytes: number | null
  /** Smaller preview used in grids; falls back to the original when no thumbnail exists. */
  thumbUrl: string | null
  /** Original high-res file, signed to download as an attachment. */
  downloadUrl: string | null
}

interface VaultPhotoRow {
  id: string
  storage_path: string
  thumb_path: string | null
  file_name: string
  width: number | null
  height: number | null
  size_bytes: string | number | null
}

async function toPhotoViews(rows: VaultPhotoRow[]): Promise<VaultPhotoView[]> {
  if (rows.length === 0) return []

  const storage = createAdminClient().storage.from(VAULT_PHOTOS_BUCKET)
  const displayPaths = rows.map((row) => row.thumb_path ?? row.storage_path)
  const originalPaths = rows.map((row) => row.storage_path)

  const [display, originals] = await Promise.all([
    storage.createSignedUrls(displayPaths, SIGNED_URL_TTL_SECONDS),
    storage.createSignedUrls(originalPaths, SIGNED_URL_TTL_SECONDS, { download: true }),
  ])

  return rows.map((row, index) => ({
    id: row.id,
    fileName: row.file_name,
    width: row.width,
    height: row.height,
    sizeBytes: row.size_bytes === null ? null : Number(row.size_bytes),
    thumbUrl: display.data?.[index]?.signedUrl ?? null,
    downloadUrl: originals.data?.[index]?.signedUrl ?? null,
  }))
}

async function selectVaultPhotos(vaultId: string) {
  const { rows } = await sql<VaultPhotoRow>`
    SELECT id, storage_path, thumb_path, file_name, width, height, size_bytes
    FROM vault_photos
    WHERE vault_id = ${vaultId}
    ORDER BY created_at ASC, file_name ASC
  `
  return rows
}

/** Everything attached to a vault, for the admin delivery section. */
export async function listVaultPhotosAdmin(vaultId: string): Promise<VaultPhotoView[]> {
  await requireAdmin()
  return toPhotoViews(await selectVaultPhotos(vaultId))
}

/** Records a photo that was already uploaded straight to storage by the admin's browser. */
export async function recordVaultPhoto(
  vaultId: string,
  input: {
    storagePath: string
    thumbPath: string | null
    fileName: string
    contentType: string
    sizeBytes: number
    width: number | null
    height: number | null
  }
): Promise<void> {
  await requireAdmin()

  const prefix = `vault-photos/${vaultId}/`
  if (!input.storagePath.startsWith(prefix) || (input.thumbPath && !input.thumbPath.startsWith(prefix))) {
    throw new Error("Photos must be uploaded to this vault's folder")
  }

  const fileName = input.fileName.trim().slice(0, MAX_FILE_NAME_LENGTH) || "photo"

  await sql`
    INSERT INTO vault_photos (vault_id, storage_path, thumb_path, file_name, content_type, size_bytes, width, height)
    VALUES (
      ${vaultId}, ${input.storagePath}, ${input.thumbPath}, ${fileName}, ${input.contentType},
      ${input.sizeBytes}, ${input.width}, ${input.height}
    )
  `

  revalidatePath("/admin/operations")
}

export async function deleteVaultPhoto(photoId: string): Promise<void> {
  await requireAdmin()

  const { rows } = await sql<{ storage_path: string; thumb_path: string | null }>`
    DELETE FROM vault_photos WHERE id = ${photoId} RETURNING storage_path, thumb_path
  `
  const removed = rows[0]
  if (!removed) return

  const paths = [removed.storage_path, removed.thumb_path].filter((path): path is string => Boolean(path))
  await createAdminClient().storage.from(VAULT_PHOTOS_BUCKET).remove(paths)

  revalidatePath("/admin/operations")
}

/**
 * The client's final photos. Only available to the vault's signed-in client once the shoot is
 * Delivered & Settled (admins can preview at any stage).
 */
export async function getDeliveryPhotos(vaultId: string): Promise<VaultPhotoView[] | null> {
  if (!(await canViewDelivery(vaultId))) return null
  return toPhotoViews(await selectVaultPhotos(vaultId))
}
