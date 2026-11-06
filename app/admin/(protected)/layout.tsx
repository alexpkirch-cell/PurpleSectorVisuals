import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { AdminMobileNav, AdminSidebar } from "@/components/admin/admin-sidebar"
import { ResizeObserverGuard } from "@/components/admin/resize-observer-guard"

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
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      <AdminSidebar displayName={profile.display_name} />
      <div className="flex w-full min-w-0 flex-1 flex-col">
        <AdminMobileNav displayName={profile.display_name} />
        <main className="w-full min-w-0 flex-1 overflow-x-hidden px-4 py-6 sm:px-6 md:py-8 lg:px-8 lg:py-10">{children}</main>
      </div>
    </div>
  )
}
