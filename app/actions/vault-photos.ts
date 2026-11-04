"use server"

import { revalidatePath } from "next/cache"

import { sql } from "@/lib/db"
import { requireAdmin } from "@/lib/require-admin"
import { createAdminClient } from "@/lib/supabase/server"
import { canViewDelivery } from "@/lib/vault-delivery"
import { VAULT_PHOTOS_BUCKET } from "@/lib/vault-photo-storage"
import { signStoragePaths } from "@/lib/vault-photo-signing"

const MAX_FILE_NAME_LENGTH = 255
const MAX_TITLE_LENGTH = 200

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
  bucket: string
  storage_path: string
  thumb_path: string | null
  file_name: string
  width: number | null
  height: number | null
  size_bytes: string | number | null
}

async function toPhotoViews(rows: VaultPhotoRow[]): Promise<VaultPhotoView[]> {
  if (rows.length === 0) return []

  const [display, originals] = await Promise.all([
    signStoragePaths(rows.map((row) => ({ bucket: row.bucket, path: row.thumb_path ?? row.storage_path }))),
    signStoragePaths(
      rows.map((row) => ({ bucket: row.bucket, path: row.storage_path })),
      { download: true }
    ),
  ])

  return rows.map((row, index) => ({
    id: row.id,
    fileName: row.file_name,
    width: row.width,
    height: row.height,
    sizeBytes: row.size_bytes === null ? null : Number(row.size_bytes),
    thumbUrl: display[index],
    downloadUrl: originals[index],
  }))
}

async function selectVaultPhotos(vaultId: string) {
  const { rows } = await sql<VaultPhotoRow>`
    SELECT id, bucket, storage_path, thumb_path, file_name, width, height, size_bytes
    FROM vault_photos
    WHERE vault_id = ${vaultId}
    ORDER BY sort_order ASC NULLS LAST, created_at ASC, file_name ASC
  `
  return rows
}

/** Everything attached to a vault, for the admin delivery section. */
export async function listVaultPhotosAdmin(vaultId: string): Promise<VaultPhotoView[]> {
  await requireAdmin()
  return toPhotoViews(await selectVaultPhotos(vaultId))
}

/**
 * Records a photo that was already uploaded straight to the private bucket by the admin's browser,
 * and files it in the global media library so it can be found later. Optional metadata (who shot and
 * edited it, categories) feeds the library filters.
 */
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
    shooter?: string | null
    editor?: string | null
    categories?: string[]
    title?: string
  }
): Promise<void> {
  await requireAdmin()

  const prefix = `vault-photos/${vaultId}/`
  if (!input.storagePath.startsWith(prefix) || (input.thumbPath && !input.thumbPath.startsWith(prefix))) {
    throw new Error("Photos must be uploaded to this vault's folder")
  }

  const fileName = input.fileName.trim().slice(0, MAX_FILE_NAME_LENGTH) || "photo"
  const shooter = input.shooter?.trim() || null
  const editor = input.editor?.trim() || null
  const categories = [...new Set(input.categories ?? [])]
  const title = (input.title ?? "").trim().slice(0, MAX_TITLE_LENGTH)

  await sql`
    INSERT INTO vault_photos (vault_id, bucket, storage_path, thumb_path, file_name, content_type, size_bytes, width, height, sort_order)
    VALUES (
      ${vaultId}, ${VAULT_PHOTOS_BUCKET}, ${input.storagePath}, ${input.thumbPath}, ${fileName}, ${input.contentType},
      ${input.sizeBytes}, ${input.width}, ${input.height},
      (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM vault_photos WHERE vault_id = ${vaultId})
    )
  `

  // public_url stays null: the library lists only public files, so client photos never reach the public site.
  await sql`
    INSERT INTO media_library (
      bucket, storage_path, public_url, file_name, content_type, size_bytes, width, height,
      shooter, editor, categories, title, vault_id
    )
    VALUES (
      ${VAULT_PHOTOS_BUCKET}, ${input.storagePath}, NULL, ${fileName}, ${input.contentType}, ${input.sizeBytes},
      ${input.width}, ${input.height}, ${shooter}, ${editor}, ${categories}::text[], ${title}, ${vaultId}
    )
    ON CONFLICT (bucket, storage_path) DO NOTHING
  `

  revalidatePath("/admin/operations")
}

/** Attaches photos that already exist in the media library to a vault without copying the files. */
export async function attachMediaToVault(vaultId: string, mediaIds: string[]): Promise<number> {
  await requireAdmin()
  if (mediaIds.length === 0) return 0

  const { rowCount } = await sql`
    INSERT INTO vault_photos (vault_id, bucket, storage_path, thumb_path, file_name, content_type, size_bytes, width, height, sort_order)
    SELECT ${vaultId}, m.bucket, m.storage_path, NULL, m.file_name, m.content_type, m.size_bytes, m.width, m.height,
      (SELECT COALESCE(MAX(sort_order), -1) FROM vault_photos WHERE vault_id = ${vaultId}) + ROW_NUMBER() OVER (ORDER BY m.created_at)
    FROM media_library m
    WHERE m.id = ANY(${mediaIds}::uuid[])
      AND m.public_url IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM vault_photos p
        WHERE p.vault_id = ${vaultId} AND p.bucket = m.bucket AND p.storage_path = m.storage_path
      )
  `

  revalidatePath("/admin/operations")
  return rowCount ?? 0
}

/** Persists the admin's drag-free reorder; `orderedIds` is the new first-to-last order the client will see. */
export async function reorderVaultPhotos(vaultId: string, orderedIds: string[]): Promise<void> {
  await requireAdmin()
  if (orderedIds.length === 0) return

  await sql`
    UPDATE vault_photos p
    SET sort_order = (u.position - 1)::int
    FROM unnest(${orderedIds}::uuid[]) WITH ORDINALITY AS u(id, position)
    WHERE p.id = u.id AND p.vault_id = ${vaultId}
  `

  revalidatePath("/admin/operations")
}

export async function deleteVaultPhoto(photoId: string): Promise<void> {
  await requireAdmin()

  const { rows } = await sql<{ bucket: string; storage_path: string; thumb_path: string | null }>`
    DELETE FROM vault_photos WHERE id = ${photoId} RETURNING bucket, storage_path, thumb_path
  `
  const removed = rows[0]
  if (!removed) return

  // Only files this vault owns are deleted. A shared library file just loses its link to the vault.
  if (removed.bucket === VAULT_PHOTOS_BUCKET) {
    const paths = [removed.storage_path, removed.thumb_path].filter((path): path is string => Boolean(path))
    await createAdminClient().storage.from(VAULT_PHOTOS_BUCKET).remove(paths)
    await sql`DELETE FROM media_library WHERE bucket = ${removed.bucket} AND storage_path = ${removed.storage_path}`
  }

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
