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

        // Classes + direct student profiles + linked profile IDs (in parallel)
        const [
            { data: classesData },
            { data: directProfiles },
            { data: linkedLinks },
        ] = await Promise.all([
            db.from('classes').select('id, name').eq('school_id', schoolId).order('name'),
            db.from('profiles')
                .select('id, full_name, email, status, gender, national_id, phone, school_id')
                .eq('role', 'student')
                .eq('school_id', schoolId)
                .order('full_name'),
            db.from('profile_schools')
                .select('profile_id')
                .eq('school_id', schoolId)
                .eq('role', 'student'),
        ])

        // Fetch linked profiles if any
        const linkedIds = (linkedLinks || []).map((r: any) => r.profile_id)
        let linkedProfiles: any[] = []
        if (linkedIds.length > 0) {
            const { data } = await db
                .from('profiles')
                .select('id, full_name, email, status, gender, national_id, phone, school_id')
                .eq('role', 'student')
                .in('id', linkedIds)
            linkedProfiles = data || []
        }

        // Merge & deduplicate
        const profileMap = new Map<string, any>()
        ;(directProfiles || []).forEach((p: any) => profileMap.set(p.id, p))
        ;(linkedProfiles || []).forEach((p: any) => { if (!profileMap.has(p.id)) profileMap.set(p.id, p) })
        const mergedProfiles = Array.from(profileMap.values())

        if (!mergedProfiles.length) {
            return NextResponse.json({ students: [], classes: classesData || [] })
        }

        const studentIds = mergedProfiles.map((p: any) => p.id)

        // Enrollments + overdue payments (in parallel)
        const now = new Date()
        const startOfMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

        const [{ data: enrollments }, { data: overduePayments }] = await Promise.all([
            db.from('enrollments')
                .select('student_id, class_id, academic_year_id, academic_years(name), classes(name), status')
                .in('student_id', studentIds)
                .eq('school_id', schoolId)
                .order('created_at', { ascending: false }),
            db.from('payments')
                .select('student_id, payment_status, due_date')
                .in('student_id', studentIds)
                .eq('school_id', schoolId)
                .in('payment_status', ['pending', 'overdue']),
        ])

        // Build enrollment map (latest per student)
        const enrollMap = new Map<string, any>()
        ;(enrollments || []).forEach((e: any) => {
            if (!enrollMap.has(e.student_id)) enrollMap.set(e.student_id, e)
        })

        // Overdue set
        const overdueSet = new Set(
            (overduePayments || [])
                .filter((p: any) => p.payment_status === 'overdue' || (p.due_date && p.due_date < startOfMonthStr))
                .map((p: any) => p.student_id)
        )

        const students = mergedProfiles
            .filter((p: any) => {
                const enroll = enrollMap.get(p.id)
                const isTransferred = p.school_id !== schoolId || enroll?.status === 'transferred'
                return !isTransferred
            })
            .map((p: any) => {
                const enroll = enrollMap.get(p.id)
                const parts = (p.full_name || 'Élève').split(' ')
                return {
                    id: p.id,
                    name: p.full_name || 'Élève',
                    className: (enroll?.classes as any)?.name || '',
                    classId: enroll?.class_id || '',
                    status: p.status || 'active',
                    isTransferred: false,
                    gender: p.gender ?? null,
                    paymentStatus: overdueSet.has(p.id) ? 'overdue' : 'ok',
                    academicYear: (enroll?.academic_years as any)?.name ?? null,
                    initials: (parts.length >= 2
                        ? `${parts[0][0]}${parts[1][0]}`
                        : parts[0].slice(0, 2)
                    ).toUpperCase(),
                    email: p.email || '',
                    nationalId: p.national_id ?? null,
                    phone: p.phone ?? null,
                }
            })

        return NextResponse.json({ students, classes: classesData || [] })
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Erreur serveur' }, { status: 500 })
    }
}
