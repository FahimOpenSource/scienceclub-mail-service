import { createClient } from "@supabase/supabase-js"

function getEnv(name: string) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

export function createSupabaseAdminClient() {
  return createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SECRET_KEY"), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
