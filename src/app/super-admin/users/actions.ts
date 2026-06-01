'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

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

    // 2. Update password in auth via admin client
    const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
        password: newPassword.trim()
    })

    if (updateError) {
        console.error('Password update failed:', updateError)
        return { error: `Échec de mise à jour du mot de passe: ${updateError.message}` }
    }

    return { success: true }
}
