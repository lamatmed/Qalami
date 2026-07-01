import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const classId = searchParams.get('classId')

        const supabase = await createClient()
        const { data: { session } } = await supabase.auth.getSession()
        const user = session?.user
        if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

        const db = createAdminClient()
        const { data: profile } = await db
            .from('profiles').select('school_id').eq('id', user.id).maybeSingle()

        if (!profile?.school_id) return NextResponse.json({ error: 'no_school' }, { status: 403 })
        const schoolId = profile.school_id

        let subjects: { id: string; name: string }[] = []
        let assignments: { teacher_id: string; subject_id: string }[] = []

        if (classId) {
            const { data: assignedSubjects } = await db
                .from('teacher_assignments')
                .select('subject_id, subjects:subject_id(id, name)')
                .eq('class_id', classId)

            const seen = new Set<string>()
            subjects = ((assignedSubjects || []) as any[])
                .map(a => a.subjects)
                .filter((s): s is { id: string; name: string } => Boolean(s?.id))
                .filter(s => { if (seen.has(s.id)) return false; seen.add(s.id); return true })
                .sort((a, b) => a.name.localeCompare(b.name))

            const { data: assignData } = await db
                .from('teacher_assignments')
                .select('teacher_id, subject_id')
                .eq('class_id', classId)
            assignments = assignData || []
        } else {
            const { data } = await db
                .from('subjects')
                .select('id, name')
                .eq('school_id', schoolId)
                .order('name')
            subjects = data || []
        }

        return NextResponse.json({ subjects, assignments })
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Erreur serveur' }, { status: 500 })
    }
}
