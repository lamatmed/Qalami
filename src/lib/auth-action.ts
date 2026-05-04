'use server'

import { createClient } from '@/utils/supabase/server'

export interface ActionContext {
    supabase: Awaited<ReturnType<typeof createClient>>
    userId: string
    schoolId: string
    role: string
}

const DEFAULT_ROLES = ['admin', 'super_admin', 'school_staff'] as const

/**
 * Shared auth context for all server actions.
 * Returns null if the user is unauthenticated, has no school, or lacks a required role.
 * Replaces the copy-pasted getSchoolAndUser / getSchoolId / getAuthContext pattern.
 */
export async function getActionContext(
    allowedRoles: readonly string[] = DEFAULT_ROLES,
): Promise<ActionContext | null> {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: profile } = await supabase
        .from('profiles')
        .select('school_id, role')
        .eq('id', user.id)
        .single()

    if (!profile?.school_id) return null
    if (!allowedRoles.includes(profile.role)) return null

    return {
        supabase,
        userId: user.id,
        schoolId: profile.school_id,
        role: profile.role,
    }
}
