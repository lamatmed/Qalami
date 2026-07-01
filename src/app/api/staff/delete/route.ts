import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

export async function DELETE(req: NextRequest) {
    const { profileId } = await req.json()

    if (!profileId) {
        return NextResponse.json({ error: 'ID profil manquant' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
        const user = session?.user
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { data: callerProfile } = await supabase
        .from('profiles')
        .select('school_id, role')
        .eq('id', user.id)
        .maybeSingle()

    if (!callerProfile?.school_id) {
        return NextResponse.json({ error: 'École introuvable' }, { status: 403 })
    }

    const ADMIN_ROLES = ['admin', 'super_admin', 'school_staff']
    if (!ADMIN_ROLES.includes(callerProfile.role)) {
        return NextResponse.json({ error: 'Permission refusée' }, { status: 403 })
    }

    const admin = createAdminClient()

    const { data: staffProfile } = await admin
        .from('profiles')
        .select('school_id')
        .eq('id', profileId)
        .maybeSingle()

    if (!staffProfile || staffProfile.school_id !== callerProfile.school_id) {
        return NextResponse.json({ error: 'Permission refusée' }, { status: 403 })
    }

    const { error, count } = await admin
        .from('profiles')
        .delete({ count: 'exact' })
        .eq('id', profileId)

    if (error) {
        console.error('[staff/delete] DB error:', error.code)
        return NextResponse.json({ error: 'Suppression échouée' }, { status: 500 })
    }

    return NextResponse.json({ success: true, count })
}
