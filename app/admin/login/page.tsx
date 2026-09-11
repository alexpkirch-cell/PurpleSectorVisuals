import type { Metadata } from "next"

import { AdminLoginForm } from "@/components/admin/login-form"

export const metadata: Metadata = {
  title: "Admin Login | Purple Sector Visuals",
  robots: { index: false, follow: false },
}

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8">
        <div className="mb-6 flex flex-col gap-1">
          <span className="font-heading text-xs font-bold tracking-[0.18em] text-muted-foreground">
            PURPLE SECTOR VISUALS
          </span>
          <h1 className="font-heading text-xl font-medium text-foreground">Studio sign in</h1>
          <p className="text-sm text-muted-foreground">
            Access the command center to manage galleries and site assets.
          </p>
        </div>
        <AdminLoginForm />
      </div>
    </main>
  )
}
