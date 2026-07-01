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

        const { data: levelsData } = await db
            .from('levels')
            .select('id, name_fr, name_ar')
            .eq('school_id', schoolId)
            .order('order', { ascending: true })

        if (!levelsData || levelsData.length === 0) {
            return NextResponse.json({ levels: [] })
        }

        const levelIds = levelsData.map((l: any) => l.id)

        const { data: classes } = await db
            .from('classes')
            .select('id, name, capacity, level_id')
            .eq('school_id', schoolId)
            .in('level_id', levelIds)
            .order('name', { ascending: true })

        const allClassIds = (classes || []).map((c: any) => c.id)
        const studentCounts = new Map<string, number>()

        if (allClassIds.length > 0) {
            const { data: enrollments } = await db
                .from('enrollments')
                .select('class_id')
                .in('class_id', allClassIds)
                .eq('status', 'active')
            ;(enrollments || []).forEach((e: any) => {
                studentCounts.set(e.class_id, (studentCounts.get(e.class_id) || 0) + 1)
            })
        }

        const classMap = new Map<string, any[]>()
        ;(classes || []).forEach((cls: any) => {
            if (!cls.level_id) return
            if (!classMap.has(cls.level_id)) classMap.set(cls.level_id, [])
            classMap.get(cls.level_id)!.push({
                id: cls.id,
                name: cls.name,
                students: studentCounts.get(cls.id) || 0,
                capacity: cls.capacity || 40,
            })
        })

        const levels = levelsData.map((l: any) => ({
            id: l.id,
            nameFr: l.name_fr,
            nameAr: l.name_ar,
            classes: classMap.get(l.id) || [],
        }))

        return NextResponse.json({ levels })
    } catch (err: any) {
        console.error('[/api/admin/levels]', err)
        return NextResponse.json({ error: err?.message || 'Erreur serveur' }, { status: 500 })
    }
}
