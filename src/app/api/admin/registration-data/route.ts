import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { session } } = await supabase.auth.getSession()
        const user = session?.user
        if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

        const db = createAdminClient()
        const { data: profile } = await db
            .from('profiles')
            .select('school_id')
            .eq('id', user.id)
            .maybeSingle()

        if (!profile?.school_id) return NextResponse.json({ error: 'no_school' }, { status: 403 })
        const schoolId = profile.school_id

        const [
            { data: levelData, error: levelErr },
            { data: classData, error: classErr },
        ] = await Promise.all([
            db.from('levels').select('id, name_fr, order, cycle').eq('school_id', schoolId).order('order'),
            db.from('classes').select('id, name, level_id').eq('school_id', schoolId).order('name'),
        ])

        if (levelErr) console.error('[registration-data] levels error:', levelErr.message)
        if (classErr) console.error('[registration-data] classes error:', classErr.message)

        // cycle_fees_config is optional — ignore if table doesn't exist
        let cycleConfigs: any[] = []
        try {
            const { data: activeYear } = await db
                .from('academic_years')
                .select('id')
                .eq('school_id', schoolId)
                .eq('is_current', true)
                .maybeSingle()

            if (activeYear?.id) {
                const { data: configs } = await db
                    .from('cycle_fees_config')
                    .select('*')
                    .eq('school_id', schoolId)
                    .eq('academic_year_id', activeYear.id)
                cycleConfigs = configs || []
            }
        } catch (_) {
            // table might not exist
        }

        return NextResponse.json({
            levels: levelData || [],
            classes: classData || [],
            cycleConfigs,
        })
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Erreur serveur' }, { status: 500 })
    }
}
