import { createBrowserClient } from '@supabase/ssr'

// Browser-safe client — use in client components
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const DEMO_USER_ID = '66d35c8f-3db8-4c0b-80d3-9a8553e3605e'
