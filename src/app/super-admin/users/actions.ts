'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function fetchSuperAdminUsersData() {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Non authentifié' }

    const { data: profile } = await adminClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!profile || profile.role !== 'super_admin') {
        return { error: 'Accès non autorisé' }
    }

    const [schoolsRes, usersRes] = await Promise.all([
        adminClient.from('schools').select('id, name').order('name'),
        adminClient.from('profiles').select('id, email, full_name, role, phone, school_id, created_at').order('created_at', { ascending: false }),
    ])

    return {
        schools: schoolsRes.data ?? [],
        users: usersRes.data ?? [],
    }
}

export async function updateUserPassword(userId: string, newPassword: string) {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // 1. Authenticate and authorize Super Admin
    const { data: { user }, error: authCheckError } = await supabase.auth.getUser()
    if (authCheckError || !user) {
        return { error: 'Non authentifié' }
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!profile || profile.role !== 'super_admin') {
        return { error: 'Accès non autorisé. Vous devez être Super Admin.' }
    }

    if (!newPassword || !/^\d{6}$/.test(newPassword.trim())) {
        return { error: 'Le mot de passe doit être exactement 6 chiffres' }
    }

    // 2. Fetch the user's phone from profile to ensure phone identity exists
    const { data: targetProfile } = await adminClient
        .from('profiles')
        .select('phone')
        .eq('id', userId)
        .single()

    // Update password and re-confirm phone provider so the user can sign in with phone+password
    const updatePayload: { password: string; phone?: string; phone_confirm?: boolean } = {
        password: newPassword.trim()
    }
    if (targetProfile?.phone) {
        updatePayload.phone = targetProfile.phone
        updatePayload.phone_confirm = true
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, updatePayload)

    if (updateError) {
        console.error('Password update failed:', updateError)
        return { error: `Échec de mise à jour du mot de passe: ${updateError.message}` }
    }

    return { success: true }
}
