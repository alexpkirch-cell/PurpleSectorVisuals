import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"

import { isPortfolioCategory } from "@/lib/portfolio-categories"
import { PORTFOLIO_IMAGES_BUCKET } from "@/lib/storage-buckets"
import { VAULT_PHOTOS_BUCKET } from "@/lib/vault-photo-storage"
import { requireAdmin } from "@/lib/require-admin"
import { createAdminClient } from "@/lib/supabase/server"
import { sql } from "@/lib/db"

export const runtime = "nodejs"

const MAX_IMAGES = 50
const MAX_IMAGE_BYTES = 50 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

/**
 * EXIF parsing is deliberately isolated here so `exifr` can be added later without changing the upload contract.
 * Until then, uploads are accepted with nullable EXIF columns. Keep parsing on the server; never trust browser metadata.
 */
async function extractExifData(bytes: Buffer): Promise<{
  cameraBody: string | null
  lens: string | null
  aperture: number | null
  shutterSpeed: string | null
  iso: number | null
  focalLength: number | null
}> {
  // TODO: install exifr and map Make/Model, LensModel, FNumber, ExposureTime, ISO and FocalLength here.
  void bytes
  return {
    cameraBody: null,
    lens: null,
    aperture: null,
    shutterSpeed: null,
    iso: null,
    focalLength: null,
  }
}

function parseMemberIds(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return [] as string[]
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    throw new Error("Shooter and editor IDs must be valid JSON arrays.")
  }
  if (!Array.isArray(parsed) || parsed.some((id) => typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id))) {
    throw new Error("Shooter and editor IDs must be valid team-member IDs.")
  }
  return [...new Set(parsed)] as string[]
}

function cleanFileName(value: string) {
  return value.trim().replace(/[\\/\0-\x1f]/g, "-").slice(0, 255) || "photo"
}

export async function POST(request: Request) {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "Expected a multipart form with an images[] array." }, { status: 400 })
  }

  const images = formData.getAll("images").filter((value): value is File => value instanceof File && value.size > 0)
  if (images.length === 0 || images.length > MAX_IMAGES) {
    return NextResponse.json({ error: `Upload between 1 and ${MAX_IMAGES} images per batch.` }, { status: 400 })
  }
  for (const image of images) {
    if (!ALLOWED_IMAGE_TYPES.has(image.type)) {
      return NextResponse.json({ error: "Only JPEG, PNG and WebP images are supported." }, { status: 415 })
    }
    if (image.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Each image must be 50 MB or smaller." }, { status: 413 })
    }
  }

  const rawPublicFlag = formData.get("is_public_portfolio")
  if (rawPublicFlag !== "true" && rawPublicFlag !== "false") {
    return NextResponse.json({ error: "is_public_portfolio must be true or false." }, { status: 400 })
  }
  const isPublicPortfolio = rawPublicFlag === "true"
  const galleryIdValue = formData.get("gallery_id")
  const galleryId = typeof galleryIdValue === "string" && galleryIdValue.trim() ? galleryIdValue.trim() : null
  if (!isPublicPortfolio && !galleryId) {
    return NextResponse.json({ error: "Choose a client gallery or enable public portfolio publishing." }, { status: 400 })
  }
  if (galleryId && !/^[0-9a-f-]{36}$/i.test(galleryId)) {
    return NextResponse.json({ error: "gallery_id must be a valid gallery ID." }, { status: 400 })
  }

  const categoryValue = formData.get("category")
  const category = typeof categoryValue === "string" ? categoryValue.trim().toLowerCase() : ""
  if (isPublicPortfolio && !isPortfolioCategory(category)) {
    return NextResponse.json({ error: "Choose a valid public portfolio category." }, { status: 400 })
  }

  let shooterIds: string[]
  let editorIds: string[]
  try {
    shooterIds = parseMemberIds(formData.get("shooter_ids"))
    editorIds = parseMemberIds(formData.get("editor_ids"))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid team credits." }, { status: 400 })
  }
  if (shooterIds.length > 12 || editorIds.length > 12) {
    return NextResponse.json({ error: "Assign no more than 12 shooters or editors per image." }, { status: 400 })
  }

  if (galleryId) {
    const { rows } = await sql<{ id: string }>`SELECT id FROM public.galleries WHERE id = ${galleryId} LIMIT 1`
    if (!rows[0]) return NextResponse.json({ error: "Client gallery not found." }, { status: 404 })
  }

  const allMemberIds = [...new Set([...shooterIds, ...editorIds])]
  const memberRows = allMemberIds.length
    ? (await sql<{ id: string; name: string }>`
        SELECT id, name FROM public.team_members
        WHERE id = ANY(${allMemberIds}::uuid[]) AND is_active = true
      `).rows
    : []
  if (memberRows.length !== allMemberIds.length) {
    return NextResponse.json({ error: "Choose only active team members for credits." }, { status: 400 })
  }
  const namesById = new Map(memberRows.map((member) => [member.id, member.name]))
  const shooterNames = shooterIds.map((id) => namesById.get(id)!)
  const editorNames = editorIds.map((id) => namesById.get(id)!)

  const titleValue = formData.get("title")
  const title = typeof titleValue === "string" ? titleValue.trim().slice(0, 200) : ""
  const storage = createAdminClient().storage
  const results: { fileName: string; galleryPhotoId?: string; portfolioItemId?: string; error?: string }[] = []

  for (const image of images) {
    const id = randomUUID()
    const extension = EXTENSION_BY_MIME[image.type]
    const fileName = cleanFileName(image.name)
    const bytes = Buffer.from(await image.arrayBuffer())
    const exif = await extractExifData(bytes)
    const uploaded: { bucket: string; path: string }[] = []
    let galleryPhotoId: string | undefined
    let portfolioItemId: string | undefined
    let mediaLibraryPath: string | null = null

    try {
      let galleryPath: string | null = null
      if (galleryId) {
        galleryPath = `bulk-upload/${galleryId}/${id}.${extension}`
        const upload = await storage.from(VAULT_PHOTOS_BUCKET).upload(galleryPath, bytes, {
          contentType: image.type,
          upsert: false,
        })
        if (upload.error) throw new Error("Could not save the client-gallery copy.")
        uploaded.push({ bucket: VAULT_PHOTOS_BUCKET, path: galleryPath })

        const { rows } = await sql<{ id: string }>`
          INSERT INTO public.gallery_photos (
            gallery_id, storage_path, file_name, content_type, size_bytes, is_public_portfolio
          ) VALUES (
            ${galleryId}, ${galleryPath}, ${fileName}, ${image.type}, ${image.size}, ${isPublicPortfolio}
          ) RETURNING id
        `
        galleryPhotoId = rows[0].id
      }

      if (isPublicPortfolio) {
        const publicPath = `${category}/${id}.${extension}`
        const upload = await storage.from(PORTFOLIO_IMAGES_BUCKET).upload(publicPath, bytes, {
          contentType: image.type,
          upsert: false,
        })
        if (upload.error) throw new Error("Could not save the public portfolio copy.")
        uploaded.push({ bucket: PORTFOLIO_IMAGES_BUCKET, path: publicPath })
        const imageUrl = storage.from(PORTFOLIO_IMAGES_BUCKET).getPublicUrl(publicPath).data.publicUrl
        const settings = [
          exif.aperture !== null ? `f/${exif.aperture}` : null,
          exif.shutterSpeed,
          exif.iso !== null ? `ISO ${exif.iso}` : null,
          exif.focalLength !== null ? `${exif.focalLength}mm` : null,
        ].filter(Boolean).join(" · ") || null
        const { rows } = await sql<{ id: string }>`
          INSERT INTO public.portfolio_items (
            title, category, categories, shooter, shot_by, edited_by,
            camera, camera_body, lens, aperture, shutter_speed, iso, focal_length, settings,
            image_url, featured, sort_order
          )
          VALUES (
            ${title || fileName}, ${category}, ARRAY[${category}]::text[],
            ${shooterNames.join(", ") || null}, ${shooterNames.join(", ") || null}, ${editorNames.join(", ") || null},
            ${exif.cameraBody}, ${exif.cameraBody}, ${exif.lens}, ${exif.aperture}, ${exif.shutterSpeed}, ${exif.iso}, ${exif.focalLength}, ${settings},
            ${imageUrl}, false, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM public.portfolio_items)
          ) RETURNING id
        `
        portfolioItemId = rows[0].id
        mediaLibraryPath = publicPath
        await sql`
          INSERT INTO public.media_library (
            bucket, storage_path, public_url, file_name, content_type, size_bytes,
            shooter, editor, categories, title
          ) VALUES (
            ${PORTFOLIO_IMAGES_BUCKET}, ${publicPath}, ${imageUrl}, ${fileName}, ${image.type}, ${image.size},
            ${shooterNames.join(", ") || null}, ${editorNames.join(", ") || null}, ARRAY[${category}]::text[], ${title || fileName}
          )
          ON CONFLICT (bucket, storage_path) DO NOTHING
        `

        const creditRows = [
          ...shooterIds.map((teamMemberId, sortOrder) => ({ team_member_id: teamMemberId, credit_type: "shooter", sort_order: sortOrder })),
          ...editorIds.map((teamMemberId, sortOrder) => ({ team_member_id: teamMemberId, credit_type: "editor", sort_order: sortOrder })),
        ]
        if (creditRows.length) {
          await sql`
            INSERT INTO public.portfolio_item_team_members (portfolio_item_id, team_member_id, credit_type, sort_order)
            SELECT ${portfolioItemId}, credit.team_member_id, credit.credit_type, credit.sort_order
            FROM jsonb_to_recordset(${JSON.stringify(creditRows)}::jsonb)
              AS credit(team_member_id uuid, credit_type text, sort_order integer)
            ON CONFLICT DO NOTHING
          `
        }
      }

      results.push({ fileName, galleryPhotoId, portfolioItemId })
    } catch (error) {
      if (mediaLibraryPath) {
        await sql`DELETE FROM public.media_library WHERE bucket = ${PORTFOLIO_IMAGES_BUCKET} AND storage_path = ${mediaLibraryPath}`
      }
      if (portfolioItemId) {
        await sql`DELETE FROM public.portfolio_items WHERE id = ${portfolioItemId}`
      }
      if (galleryPhotoId) {
        await sql`DELETE FROM public.gallery_photos WHERE id = ${galleryPhotoId}`
      }
      await Promise.all(uploaded.map(({ bucket, path }) => storage.from(bucket).remove([path])))
      results.push({ fileName, error: error instanceof Error ? error.message : "Could not save this image." })
    }
  }

  const failed = results.filter((result) => result.error).length
  return NextResponse.json({
    results,
    uploaded: results.length - failed,
    failed,
    exifExtraction: "placeholder_until_exifr_is_installed",
  }, { status: failed === 0 ? 201 : 207 })
}
