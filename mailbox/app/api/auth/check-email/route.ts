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
  const perPage = 1000
  let page = 1

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const exists = data.users.some(
      (user) => user.email?.toLowerCase() === email,
    )

    if (exists) {
      return NextResponse.json({ exists: true })
    }

    if (data.users.length < perPage) {
      return NextResponse.json({ exists: false })
    }

    page += 1
  }
}
