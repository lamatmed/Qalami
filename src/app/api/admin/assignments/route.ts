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
            // Discovery 1: teachers with direct school_id
            { data: directTeachers },
            // Discovery 2: teachers linked via profile_schools
            { data: profileSchoolLinks },
        ] = await Promise.all([
            db.from('classes').select('id, name').eq('school_id', schoolId).order('name'),
            db.from('subjects').select('id, name').eq('school_id', schoolId).order('name'),
            db.from('profiles')
                .select('id, full_name, phone, national_id')
                .eq('school_id', schoolId)
                .eq('role', 'teacher'),
            db.from('profile_schools')
                .select('profile_id')
                .eq('school_id', schoolId)
                .eq('role', 'teacher'),
        ])

        const classIds = (classesData || []).map((c: any) => c.id)

        // Discovery 3: teachers who have assignments in this school's classes
        const { data: assignedTeacherLinks } = classIds.length > 0
            ? await db
                .from('teacher_assignments')
                .select('teacher_id')
                .in('class_id', classIds)
            : { data: [] }

        // Merge all teacher IDs from the 3 sources
        const allTeacherIds = new Set<string>()
        ;(directTeachers || []).forEach((t: any) => allTeacherIds.add(t.id))
        ;(profileSchoolLinks || []).forEach((l: any) => allTeacherIds.add(l.profile_id))
        ;(assignedTeacherLinks || []).forEach((a: any) => allTeacherIds.add(a.teacher_id))

        // Fetch profiles for all discovered teachers
        let teacherProfiles: any[] = directTeachers || []
        if (allTeacherIds.size > (directTeachers || []).length) {
            const extraIds = [...allTeacherIds].filter(
                id => !(directTeachers || []).find((t: any) => t.id === id)
            )
            if (extraIds.length > 0) {
                const { data: extra } = await db
                    .from('profiles')
                    .select('id, full_name, phone, national_id')
                    .in('id', extraIds)
                    .eq('role', 'teacher')
                teacherProfiles = [...teacherProfiles, ...(extra || [])]
            }
        }

        const { data: assignData } = classIds.length > 0
            ? await db
                .from('teacher_assignments')
                .select('id, teacher_id, class_id, subject_id, profiles:teacher_id(full_name, phone, national_id)')
                .in('class_id', classIds)
            : { data: [] }

        return NextResponse.json({
            classes: classesData || [],
            subjects: subjectsData || [],
            teachers: teacherProfiles.map((t: any) => ({
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
