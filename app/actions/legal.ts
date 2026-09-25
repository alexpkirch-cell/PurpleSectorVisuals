"use server"

import { revalidatePath } from "next/cache"

import { sql } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import { BUSINESS_DOCUMENTS_BUCKET } from "@/lib/storage-buckets"

export interface SignedContract {
  id: string
  vault_id: string
  client_signature: string | null
  signed_at: string | null
  pdf_url: string | null
  created_at: string
  client_name: string | null
  client_email: string | null
  package_title: string | null
  pin_code: string
}

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Not authenticated")
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  if (profile?.role !== "admin") {
    throw new Error("Not authorized")
  }
}

export type LegalDocumentCategory = "corporate" | "waiver" | "contractor"

export interface LegalDocument {
  id: string
  title: string
  category: LegalDocumentCategory
  file_url: string
  uploaded_at: string
  updated_at: string
}

export interface LegalDocumentWithSignedUrl extends LegalDocument {
  signedUrl: string | null
}

/** Every business document (corporate filings, model releases, contractor W-9s) with a fresh signed download link. */
export async function listLegalDocuments(): Promise<LegalDocumentWithSignedUrl[]> {
  await requireAdmin()

  const { rows } = await sql<LegalDocument>`
    SELECT * FROM legal_documents ORDER BY category ASC, uploaded_at DESC
  `

  const supabase = await createClient()

  const withUrls = await Promise.all(
    rows.map(async (doc) => {
      const { data } = await supabase.storage
        .from(BUSINESS_DOCUMENTS_BUCKET)
        .createSignedUrl(doc.file_url, 60 * 60)
      return { ...doc, signedUrl: data?.signedUrl ?? null }
    }),
  )

  return withUrls
}

export async function createLegalDocument(input: {
  title: string
  category: LegalDocumentCategory
  storagePath: string
}): Promise<void> {
  await requireAdmin()

  await sql`
    INSERT INTO legal_documents (title, category, file_url)
    VALUES (${input.title}, ${input.category}, ${input.storagePath})
  `

  revalidatePath("/admin/legal")
}

export async function deleteLegalDocument(id: string): Promise<void> {
  await requireAdmin()

  const { rows } = await sql<LegalDocument>`SELECT * FROM legal_documents WHERE id = ${id}`
  const doc = rows[0]
  if (!doc) return

  await sql`DELETE FROM legal_documents WHERE id = ${id}`

  const supabase = await createClient()
  await supabase.storage.from(BUSINESS_DOCUMENTS_BUCKET).remove([doc.file_url])

  revalidatePath("/admin/legal")
}

/** Every signed liability release, joined back to the vault, booking, and package it belongs to. */
export async function listSignedContracts(): Promise<SignedContract[]> {
  await requireAdmin()

  const { rows } = await sql<SignedContract>`
    SELECT
      c.id,
      c.vault_id,
      c.client_signature,
      c.signed_at,
      c.pdf_url,
      c.created_at,
      v.pin_code,
      TRIM(CONCAT(br.first_name, ' ', br.last_name)) AS client_name,
      br.email AS client_email,
      p.title AS package_title
    FROM contracts c
    JOIN vaults v ON v.id = c.vault_id
    LEFT JOIN booking_requests br ON br.id = v.booking_id
    LEFT JOIN packages p ON p.id = br.package_id
    ORDER BY c.signed_at DESC NULLS LAST, c.created_at DESC
  `

  return rows
}
