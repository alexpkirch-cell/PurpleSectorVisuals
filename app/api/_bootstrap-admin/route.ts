import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const accounts = [
    { email: "purplesectorvisuals@gmail.com", displayName: "Alex" },
    { email: "gabe.purplesectorvisuals@gmail.com", displayName: "Gabe" },
  ]

  const results: Record<string, string> = {}

  for (const account of accounts) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: account.email,
      password: "IL0vephotoz!",
      email_confirm: true,
      user_metadata: { display_name: account.displayName },
    })
    results[account.email] = error
      ? `ERROR: ${error.message}`
      : `CREATED: ${data.user.id}`
  }

  return NextResponse.json(results)
}
