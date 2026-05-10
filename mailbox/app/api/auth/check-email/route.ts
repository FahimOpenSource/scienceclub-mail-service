import { NextResponse } from "next/server"

import { createSupabaseAdminClient } from "@/lib/supabase/admin"

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const email = normalizeEmail(body?.email)

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email" }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc("email_has_account", {
    email_address: email,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const result = Array.isArray(data) ? data[0] : data
  const exists = Boolean(result?.has_account)
  const hasProfile = Boolean(result?.has_profile)

  return NextResponse.json({
    exists,
    userId: result?.user_id ?? null,
    isConfirmed: Boolean(result?.is_confirmed),
    hasProfile,
    canSignup: exists && !hasProfile,
  })
}
