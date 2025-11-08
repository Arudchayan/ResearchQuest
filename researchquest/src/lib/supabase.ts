import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://YOUR_PROJECT_REF.supabase.co'
const supabaseAnonKey = 'REDACTED_SUPABASE_ANON_JWT'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
