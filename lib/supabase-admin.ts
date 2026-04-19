import { createClient } from '@supabase/supabase-js'

// Server-only admin client — never import this in client components
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const DEMO_USER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
