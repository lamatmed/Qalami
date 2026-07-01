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
            { data: classesData },
            { data: subjectsData },
            { data: teachersData },
        ] = await Promise.all([
            db.from('classes').select('id, name').eq('school_id', schoolId).order('name'),
            db.from('subjects').select('id, name').eq('school_id', schoolId).order('name'),
            db.from('profiles').select('id, full_name, phone, national_id').eq('school_id', schoolId).eq('role', 'teacher'),
        ])

        const classIds = (classesData || []).map((c: any) => c.id)

        const { data: assignData } = classIds.length > 0
            ? await db
                .from('teacher_assignments')
                .select('id, teacher_id, class_id, subject_id, profiles:teacher_id(full_name, phone, national_id)')
                .in('class_id', classIds)
            : { data: [] }

        return NextResponse.json({
            classes: classesData || [],
            subjects: subjectsData || [],
            teachers: (teachersData || []).map((t: any) => ({
                id: t.id,
                name: t.full_name || '—',
                phone: t.phone,
                nni: t.national_id,
            })),
            assignments: (assignData as any[] || []).map((a: any) => ({
                id: a.id,
                teacherId: a.teacher_id,
                teacherName: (a.profiles as any)?.full_name || '—',
                teacherPhone: (a.profiles as any)?.phone,
                teacherNni: (a.profiles as any)?.national_id,
                classId: a.class_id,
                subjectId: a.subject_id,
            })),
        })
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Erreur serveur' }, { status: 500 })
    }
}
