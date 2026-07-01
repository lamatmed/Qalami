import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function GET() {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
        const user = session?.user
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { data: profile } = await supabase
        .from('profiles')
        .select('school_id, role')
        .eq('id', user.id)
        .single()

    if (!profile?.school_id) return NextResponse.json({ error: 'Aucune école associée' }, { status: 403 })

    const adminClient = createAdminClient()
    const schoolId = profile.school_id

    const [{ data: yrsData, error: yErr }, { data: tmsData, error: tErr }] = await Promise.all([
        adminClient
            .from('academic_years')
            .select('id, school_id, name, start_date, end_date, is_current, created_at')
            .eq('school_id', schoolId)
            .order('name', { ascending: false }),
        adminClient
            .from('terms')
            .select('id, school_id, academic_year_id, name, label_fr, label_ar, start_date, end_date, is_current, conseil_date, bulletin_date, created_at')
            .eq('school_id', schoolId),
    ])

    if (yErr) return NextResponse.json({ error: yErr.message }, { status: 500 })
    if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 })

    return NextResponse.json({ years: yrsData ?? [], terms: tmsData ?? [] })
}
