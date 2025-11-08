import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ouzvjzjkbzkevulxvoxu.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91enZqemprYnprZXZ1bHh2b3h1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1NDUxNjMsImV4cCI6MjA3ODEyMTE2M30.mS5weVtToci8vIcb_EAew3ln725BmT2r0j-AhAEateA'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
