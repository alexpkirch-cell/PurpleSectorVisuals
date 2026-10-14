"use server"

import { revalidatePath } from "next/cache"

import { createAdminClient, createClient } from "@/lib/supabase/server"
import { ROSTER_PORTFOLIOS_BUCKET } from "@/lib/storage-buckets"

export interface RosterContractor {
  id: string
  name: string
  bio: string | null
  profile_image_url: string | null
  portfolio_image_urls: string[]
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") throw new Error("Not authorized")

  return { supabase, user }
}

function storagePathFromUrl(url: string): string | null {
  const marker = `/${ROSTER_PORTFOLIOS_BUCKET}/`
  const index = url.indexOf(marker)
  return index === -1 ? null : decodeURIComponent(url.slice(index + marker.length))
}

export async function listRoster(): Promise<RosterContractor[]> {
  const { supabase } = await requireAdmin()
  const { data, error } = await supabase
    .from("contractors")
    .select("id, name, bio, profile_image_url, portfolio_image_urls")
    .order("created_at", { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({ ...row, portfolio_image_urls: row.portfolio_image_urls ?? [] }))
}

export async function createPhotographer(input: {
  name: string
  bio: string
  profileImageUrl: string | null
  portfolioImageUrls: string[]
}) {
  const { supabase } = await requireAdmin()
  const name = input.name.trim()
  if (!name) throw new Error("Name is required")

  const { data, error } = await supabase
    .from("contractors")
    .insert({
      name,
      bio: input.bio.trim() || null,
      profile_image_url: input.profileImageUrl,
      portfolio_image_urls: input.portfolioImageUrls,
    })
    .select("id, name, bio, profile_image_url, portfolio_image_urls")
    .single()

  if (error) throw new Error(error.message)

  revalidatePath("/admin/site-editor")
  revalidatePath(`/team/${data.id}`)
  return data as RosterContractor
}

export async function deletePhotographer(id: string) {
  const { supabase } = await requireAdmin()

  const { data: existing } = await supabase
    .from("contractors")
    .select("profile_image_url, portfolio_image_urls")
    .eq("id", id)
    .single()

  const { error } = await supabase.from("contractors").delete().eq("id", id)
  if (error) {
    throw new Error(
      error.code === "23503"
        ? "This photographer is assigned to projects. Reassign those projects before deleting."
        : error.message,
    )
  }

  if (existing) {
    const paths = [existing.profile_image_url, ...(existing.portfolio_image_urls ?? [])]
      .filter((url): url is string => Boolean(url))
      .map(storagePathFromUrl)
      .filter((path): path is string => Boolean(path))
    if (paths.length > 0) {
      await supabase.storage.from(ROSTER_PORTFOLIOS_BUCKET).remove(paths)
    }
  }

  revalidatePath("/admin/site-editor")
  revalidatePath(`/team/${id}`)
}

/** Public, read-only profile for the /team/[id] page. Exposes only display fields. */
export async function getPublicContractor(id: string): Promise<RosterContractor | null> {
  if (!UUID_PATTERN.test(id)) return null

  const supabase = createAdminClient()
  const { data } = await supabase
    .from("contractors")
    .select("id, name, bio, profile_image_url, portfolio_image_urls")
    .eq("id", id)
    .maybeSingle()

  if (!data) return null
  return { ...data, portfolio_image_urls: data.portfolio_image_urls ?? [] }
}
