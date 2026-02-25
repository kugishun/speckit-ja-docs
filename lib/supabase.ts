/**
 * Supabase Client Configuration
 * Based on: research.md Topic 1
 *
 * に関めて：
 * - Client-side: Supabase with ANON_KEY
 * - Server-side: Supabase with SERVICE_ROLE_KEY (Service Role bypass)
 * - Webhook URL: Server-side only (never exposed to client)
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
}

if (!supabaseAnonKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

/**
 * Client-side Supabase instance (RLS enforced)
 * Use this for read operations and user-specific queries
 */
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

/**
 * Server-side Supabase instance (Service Role - RLS bypass)
 * For Server Actions and API Routes - use only server-side
 * CRITICAL: Never expose SERVICE_ROLE_KEY to client
 */
export const createAdminClient = () => {
  if (!supabaseServiceKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY. Required for server-side operations.'
    )
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

/**
 * Test helper: Returns Supabase instance for tests
 */
export const getSupabaseClient = (isServer: boolean = false) => {
  if (isServer) {
    return createAdminClient()
  }
  return supabaseClient
}
