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
            .from('profiles').select('school_id').eq('id', user.id).maybeSingle()
        if (!profile?.school_id) return NextResponse.json({ error: 'no_school' }, { status: 403 })
        const schoolId = profile.school_id

        // 1. All parent IDs visible to this school (3 discovery sources in parallel)
        const [
            { data: directParents },
            { data: studentLinks },
            { data: profileSchoolLinks },
        ] = await Promise.all([
            db.from('profiles').select('id').eq('role', 'parent').eq('school_id', schoolId),
            db.from('parent_student_links')
                .select('parent_id, students:profiles!parent_student_links_student_id_fkey!inner(school_id)')
                .eq('students.school_id' as any, schoolId),
            db.from('profile_schools').select('profile_id').eq('school_id', schoolId).eq('role', 'parent'),
        ])

        const directIds = (directParents || []).map((p: any) => p.id)
        const studentLinkedIds = (studentLinks || []).map((r: any) => r.parent_id)
        const profileSchoolIds = (profileSchoolLinks || []).map((r: any) => r.profile_id)
        const allParentIds = [...new Set([...directIds, ...studentLinkedIds, ...profileSchoolIds])]

        if (!allParentIds.length) return NextResponse.json({ parents: [], schoolId })

        // 2. Full parent profiles + children links + enrollments (in parallel)
        const [
            { data: parentProfiles },
            { data: allLinks },
        ] = await Promise.all([
            db.from('profiles')
                .select('id, full_name, email, phone, avatar_url, status, address')
                .in('id', allParentIds)
                .order('full_name'),
            db.from('parent_student_links')
                .select('parent_id, students:profiles!parent_student_links_student_id_fkey!inner(id, full_name, avatar_url, national_id, school_id)')
                .in('parent_id', allParentIds)
                .eq('students.school_id' as any, schoolId),
        ])

        // 3. Fetch enrollments for students to get class names
        const studentIds = (allLinks || []).map((l: any) => l.students?.id).filter(Boolean)
        const classMap = new Map<string, string>()

        if (studentIds.length > 0) {
            const { data: enrollments } = await db
                .from('enrollments')
                .select('student_id, classes(name)')
                .in('student_id', studentIds)
                .eq('school_id', schoolId)
                .order('created_at', { ascending: false })

            ;(enrollments || []).forEach((e: any) => {
                if (!classMap.has(e.student_id) && e.classes?.name) {
                    classMap.set(e.student_id, e.classes.name)
                }
            })
        }

        // Build children map by parent
        const linksByParent = new Map<string, any[]>()
        ;(allLinks || []).forEach((link: any) => {
            const s = link.students
            if (!s) return
            const list = linksByParent.get(link.parent_id) || []
            list.push({
                id: s.id,
                name: (s.full_name || 'Enfant').split(' ')[0],
                avatar: s.avatar_url || null,
                class_name: classMap.get(s.id) || '',
                fullName: s.full_name || '',
                national_id: s.national_id || null,
            })
            linksByParent.set(link.parent_id, list)
        })

        const parents = (parentProfiles || []).map((p: any) => {
            const children = linksByParent.get(p.id) || []
            return {
                id: p.id,
                name: p.full_name || 'Parent',
                phone: p.phone || 'Non renseigné',
                status: p.status || 'active',
                address: p.address || null,
                children,
                childrenCount: children.length,
                avatar_url: p.avatar_url || null,
            }
        })

        return NextResponse.json({ parents, schoolId })
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Erreur serveur' }, { status: 500 })
    }
}
