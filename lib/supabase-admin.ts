import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from './supabase-server'

// Server-only admin client — never import this in client components
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const DEMO_USER_ID = '66d35c8f-3db8-4c0b-80d3-9a8553e3605e'

export async function getAuthUserId(): Promise<string> {
  return DEMO_USER_ID
}
