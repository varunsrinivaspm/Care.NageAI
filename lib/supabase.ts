import { createClient } from '@supabase/supabase-js'

// Browser-safe client (anon key only — used in client components)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const DEMO_USER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
