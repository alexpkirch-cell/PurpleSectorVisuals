import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { AdminSidebar } from "@/components/admin/admin-sidebar"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/admin/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "admin") {
    redirect("/admin/login")
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar displayName={profile.display_name} />
      <main className="flex-1 overflow-y-auto px-8 py-10">{children}</main>
    </div>
  )
}
