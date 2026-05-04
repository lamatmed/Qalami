'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function getMySchoolContext() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const adminClient = createAdminClient()
    const { data: profile } = await adminClient
        .from('profiles')
        .select('school_id, role, full_name, avatar_url')
        .eq('id', user.id)
        .single()

    if (!profile?.school_id) return null
    return {
        school_id: profile.school_id,
        role: profile.role,
        user_id: user.id,
        full_name: (profile as any).full_name || null,
        avatar_url: (profile as any).avatar_url || null,
    }
}
