import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function GET(_req: Request, { params }: { params: Promise<{ studentId: string }> }) {
    try {
        const { studentId } = await params

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

        const db = createAdminClient()

        const { data: adminProfile } = await db
            .from('profiles').select('school_id').eq('id', user.id).maybeSingle()
        if (!adminProfile?.school_id) return NextResponse.json({ error: 'no_school' }, { status: 403 })
        const schoolId = adminProfile.school_id

        const [{ data: school }, { data: profile }] = await Promise.all([
            db.from('schools').select('name').eq('id', schoolId).maybeSingle(),
            db.from('profiles')
                .select(`
                    school_id, full_name, phone, status,
                    date_of_birth, gender, place_of_birth, national_id, address, avatar_url,
                    enrollments (
                        id, status, academic_year_id, school_id, created_at,
                        academic_years ( name ),
                        classes ( name )
                    ),
                    parent_student_links!parent_student_links_student_id_fkey (
                        profiles!parent_student_links_parent_id_fkey (
                            id, full_name, phone
                        )
                    )
                `)
                .eq('id', studentId)
                .maybeSingle(),
        ])

        if (!profile) return NextResponse.json({ error: 'Élève introuvable' }, { status: 404 })

        const rawEnrollments = (profile.enrollments as any[]) || []
        const enrollments = rawEnrollments.filter((e: any) => e.school_id === schoolId)
        const firstEnrollment = enrollments[0]

        const parents = ((profile.parent_student_links as any[]) || [])
            .map((link: any) => link.profiles)
            .filter(Boolean)
            .map((p: any) => ({ id: p.id, full_name: p.full_name, phone: p.phone }))

        return NextResponse.json({
            schoolId,
            schoolName: school?.name || 'Établissement Qalami',
            student: {
                school_id: profile.school_id,
                full_name: profile.full_name,
                phone: (profile as any).phone || null,
                status: (profile as any).status || 'active',
                date_of_birth: (profile as any).date_of_birth || null,
                gender: (profile as any).gender || null,
                place_of_birth: (profile as any).place_of_birth || null,
                national_id: (profile as any).national_id || null,
                address: (profile as any).address || null,
                avatar_url: profile.avatar_url || null,
                className: firstEnrollment?.classes?.name || '',
                enrollmentId: firstEnrollment?.id || null,
                enrollmentStatus: firstEnrollment?.status || null,
                academicYear: (firstEnrollment?.academic_years as any)?.name || null,
                enrollmentDate: firstEnrollment?.created_at || null,
                parents,
            },
        })
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Erreur serveur' }, { status: 500 })
    }
}
