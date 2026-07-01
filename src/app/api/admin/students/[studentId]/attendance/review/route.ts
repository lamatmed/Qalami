import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function POST(req: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
    try {
        await params // ensure params resolved
        const { attendanceId, decision, note } = await req.json()

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

        const db = createAdminClient()

        const { data: adminProfile } = await db
            .from('profiles').select('school_id').eq('id', user.id).maybeSingle()
        if (!adminProfile?.school_id) return NextResponse.json({ error: 'no_school' }, { status: 403 })
        const schoolId = adminProfile.school_id

        const { data: existing } = await db
            .from('attendance')
            .select('id, student_id')
            .eq('id', attendanceId)
            .eq('school_id', schoolId)
            .maybeSingle()

        if (!existing) return NextResponse.json({ error: 'Enregistrement introuvable' }, { status: 404 })

        const updates: Record<string, any> = {
            justification_status: decision,
            justification_reviewed_by: user.id,
            justification_review_note: note || null,
        }
        if (decision === 'approved') {
            updates.justified = true
            updates.status = 'excused'
        } else {
            updates.justified = false
        }

        const { error } = await db.from('attendance').update(updates).eq('id', attendanceId)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        return NextResponse.json({ success: true })
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Erreur serveur' }, { status: 500 })
    }
}
