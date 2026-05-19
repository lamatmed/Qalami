'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

export async function deleteStaffMember(profileId: string) {
    console.log('[deleteStaff] START profileId:', profileId)

    if (!profileId) return { error: 'ID profil manquant' }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    console.log('[deleteStaff] auth user:', user?.id, 'authError:', authError?.message)
    if (!user) return { error: 'Non authentifié' }

    const { data: callerProfile, error: callerError } = await supabase
        .from('profiles')
        .select('school_id, role')
        .eq('id', user.id)
        .single()
    console.log('[deleteStaff] callerProfile:', callerProfile, 'callerError:', callerError?.message)

    if (!callerProfile?.school_id) return { error: 'École introuvable' }

    const admin = createAdminClient()

    const { data: staffProfile, error: staffError } = await admin
        .from('profiles')
        .select('id, school_id, role, full_name')
        .eq('id', profileId)
        .single()
    console.log('[deleteStaff] staffProfile:', staffProfile, 'staffError:', staffError?.message)

    if (!staffProfile) return { error: `Staff introuvable: ${staffError?.message}` }

    if (staffProfile.school_id !== callerProfile.school_id) {
        console.log('[deleteStaff] school mismatch:', staffProfile.school_id, '!=', callerProfile.school_id)
        return { error: 'Permission refusée (école différente)' }
    }

    const { error: deleteError, count } = await admin
        .from('profiles')
        .delete({ count: 'exact' })
        .eq('id', profileId)

    console.log('[deleteStaff] delete result: error=', deleteError?.message, 'code=', deleteError?.code, 'count=', count)

    if (deleteError) return { error: `${deleteError.message} (${deleteError.code})` }
    if (count === 0) return { error: `Aucune ligne supprimée (id=${profileId})` }

    return { error: null }
}

export async function updateCurrentUserPassword(newPassword: string) {
    if (!newPassword || newPassword.length < 4) {
        return { error: 'Le mot de passe doit comporter au moins 4 caractères.' }
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Non authentifié' }

    const { error } = await supabase.auth.updateUser({ password: newPassword })
    
    if (error) {
        return { error: error.message }
    }
    
    return { success: true }
}

export async function updateSchoolIdentityAction(data: {
    school_id: string
    name: string
    slogan: string
    address: string
    email: string
    logo_url?: string
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Non authentifié' }

    // Verify ownership of this school
    const { data: profile } = await supabase
        .from('profiles')
        .select('school_id, role')
        .eq('id', user.id)
        .single()

    if (!profile || profile.school_id !== data.school_id) {
        return { error: 'Accès non autorisé pour cette école.' }
    }
    
    // Restrict to admins only
    if (profile.role !== 'admin' && profile.role !== 'super_admin') {
        return { error: 'Permission de modification refusée.' }
    }

    const admin = createAdminClient()

    // 1. Update Core Schools table (Ensures global super-admin views are synced)
    const { error: coreError } = await admin
        .from('schools')
        .update({
            name: data.name,
            email: data.email,
            address: data.address,
            logo_url: data.logo_url || null
        })
        .eq('id', data.school_id)

    if (coreError) {
        console.error('Failed to update core schools:', coreError)
        return { error: `Erreur table schools: ${coreError.message}` }
    }

    // 2. Upsert School Settings overrides table
    const { error: settingsError } = await admin
        .from('school_settings')
        .upsert({
            school_id: data.school_id,
            name: data.name,
            slogan: data.slogan,
            address: data.address,
            email: data.email,
            logo_url: data.logo_url
        }, { onConflict: 'school_id' })

    if (settingsError) {
        console.error('Failed to update school_settings:', settingsError)
        return { error: `Erreur table school_settings: ${settingsError.message}` }
    }

    return { success: true }
}
