"use server"

import type { Data } from "@measured/puck"
import { revalidatePath } from "next/cache"

import { isBuiltInPagePath, validatePagePath } from "@/lib/page-layout-paths"
import { getRootProps } from "@/lib/page-layouts"
import { createClient } from "@/lib/supabase/server"

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

function isPuckData(value: unknown): value is Data {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { content?: unknown }).content)
  )
}

export async function savePageLayout(
  path: string,
  data: Data
): Promise<{ success: true } | { success: false; error: string }> {
  const pathError = isBuiltInPagePath(path) ? null : validatePagePath(path)
  if (pathError) return { success: false, error: pathError }
  if (!isPuckData(data)) return { success: false, error: "Layout data is invalid." }

  try {
    const { supabase, user } = await requireAdmin()
    const { error } = await supabase.from("page_layouts").upsert(
      {
        path,
        title: getRootProps(data).title ?? "",
        data,
        updated_by: user.id,
      },
      { onConflict: "path" }
    )
    if (error) return { success: false, error: error.message }

    revalidatePath(path)
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not publish page." }
  }
}

export async function listPageLayoutPaths(): Promise<string[]> {
  const { supabase } = await requireAdmin()
  const { data, error } = await supabase.from("page_layouts").select("path").order("path")
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => row.path)
}

export async function loadPageLayoutForEditor(path: string): Promise<Data | null> {
  const { supabase } = await requireAdmin()
  const { data, error } = await supabase.from("page_layouts").select("data").eq("path", path).maybeSingle()
  if (error) throw new Error(error.message)
  return (data?.data as Data | undefined) ?? null
}
