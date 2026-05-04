import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'

/**
 * Server-only Supabase admin client using the service_role key.
 * This client bypasses RLS and can perform admin operations like creating auth users.
 * NEVER import this in client-side code.
 */
export function createAdminClient() {
    return createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    )
}
