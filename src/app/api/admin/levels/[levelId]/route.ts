import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function GET(_req: Request, { params }: { params: Promise<{ levelId: string }> }) {
    try {
        const { levelId } = await params
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

        const db = createAdminClient()

        const { data: profile } = await db
            .from('profiles')
            .select('school_id')
            .eq('id', user.id)
            .maybeSingle()

        if (!profile?.school_id) return NextResponse.json({ error: 'no_school' }, { status: 403 })
        const schoolId = profile.school_id

        const [{ data: levelData }, { data: classesData }] = await Promise.all([
            db.from('levels').select('name_fr, name_ar').eq('id', levelId).maybeSingle(),
            db.from('classes')
                .select('id, name, capacity, updated_at')
                .eq('school_id', schoolId)
                .eq('level_id', levelId)
                .order('name', { ascending: true }),
        ])

        const classIds = (classesData || []).map((c: any) => c.id)

        const [{ data: enrollments }, { data: assignments }] = classIds.length > 0
            ? await Promise.all([
                db.from('enrollments').select('class_id').in('class_id', classIds),
                db.from('teacher_assignments').select('class_id, profiles:teacher_id(full_name)').in('class_id', classIds),
            ])
            : [{ data: [] }, { data: [] }]

        const studentCounts = new Map<string, number>()
        ;(enrollments || []).forEach((e: any) => {
            studentCounts.set(e.class_id, (studentCounts.get(e.class_id) || 0) + 1)
        })

        const teacherMap = new Map<string, string[]>()
        ;(assignments || []).forEach((a: any) => {
            const name = (a.profiles as any)?.full_name
            if (!name) return
            if (!teacherMap.has(a.class_id)) teacherMap.set(a.class_id, [])
            if (!teacherMap.get(a.class_id)!.includes(name)) teacherMap.get(a.class_id)!.push(name)
        })

        const classes = (classesData || []).map((cls: any) => ({
            id: cls.id,
            name: cls.name,
            capacity: cls.capacity || 40,
            updatedAt: cls.updated_at,
            studentCount: studentCounts.get(cls.id) || 0,
            teachers: teacherMap.get(cls.id) || [],
        }))

        return NextResponse.json({
            levelNameFr: (levelData as any)?.name_fr || '',
            levelNameAr: (levelData as any)?.name_ar || '',
            classes,
        })
    } catch (err: any) {
        console.error('[/api/admin/levels/[levelId]]', err)
        return NextResponse.json({ error: err?.message || 'Erreur serveur' }, { status: 500 })
    }
}
