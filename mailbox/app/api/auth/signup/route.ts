import { NextResponse } from "next/server"

import { createSupabaseAdminClient } from "@/lib/supabase/admin"

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const email = normalizeEmail(body?.email)
  const password = normalizeString(body?.password)
  const fullName = normalizeString(body?.fullName)
  const classStreamId = Number(body?.classStreamId)
  const boarding = Boolean(body?.boarding)

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email" }, { status: 400 })
  }

  if (!fullName) {
    return NextResponse.json(
      { error: "Full name is required" },
      { status: 400 },
    )
  }

  if (!Number.isInteger(classStreamId) || classStreamId <= 0) {
    return NextResponse.json(
      { error: "Select a class and stream" },
      { status: 400 },
    )
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Use at least 8 characters" },
      { status: 400 },
    )
  }

  const supabase = createSupabaseAdminClient()

  const { data: accountData, error: accountError } = await supabase.rpc(
    "email_has_account",
    {
      email_address: email,
    },
  )

  if (accountError) {
    return NextResponse.json({ error: accountError.message }, { status: 500 })
  }

  const account = Array.isArray(accountData) ? accountData[0] : accountData

  if (!account?.has_account || !account.user_id) {
    return NextResponse.json(
      { error: "Email not found or invalid" },
      { status: 403 },
    )
  }

  if (account.has_profile) {
    return NextResponse.json(
      { error: "This account is already set up" },
      { status: 409 },
    )
  }

  const { data: classStream, error: classStreamError } = await supabase
    .from("class_streams")
    .select("id")
    .eq("id", classStreamId)
    .maybeSingle()

  if (classStreamError) {
    return NextResponse.json(
      { error: classStreamError.message },
      { status: 500 },
    )
  }

  if (!classStream) {
    return NextResponse.json(
      { error: "Select a valid class and stream" },
      { status: 400 },
    )
  }

  const { data: userData, error: userError } =
    await supabase.auth.admin.updateUserById(account.user_id, {
      password,
      email_confirm: true,
    })

  if (userError || !userData.user) {
    return NextResponse.json(
      { error: userError?.message ?? "Could not create account" },
      { status: 400 },
    )
  }

  const { error: profileError } = await supabase.from("profiles").insert({
    id: userData.user.id,
    full_name: fullName,
    class_stream_id: classStream.id,
    boarding,
  })

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
