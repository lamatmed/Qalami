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
