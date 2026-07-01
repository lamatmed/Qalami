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

        // Payments, transactions, student details — all in parallel
        const [
            paymentsRes,
            transactionsRes,
            studentRes,
        ] = await Promise.all([
            db.from('payments')
                .select('id, amount, payment_type, payment_status, due_date, paid_at, description, receipt_number')
                .eq('student_id', studentId)
                .eq('school_id', schoolId)
                .order('due_date', { ascending: false }),
            db.from('transactions')
                .select('id, amount, category, description, transaction_date, created_at')
                .eq('related_profile_id', studentId)
                .eq('school_id', schoolId)
                .eq('type', 'income')
                .eq('status', 'completed')
                .order('created_at', { ascending: false }),
            db.from('profiles')
                .select('full_name, national_id, school_id, enrollments(classes(name))')
                .eq('id', studentId)
                .maybeSingle(),
        ])

        // Parent info
        const { data: parentLinks } = await db
            .from('parent_student_links')
            .select('parent_id, profiles!parent_student_links_parent_id_fkey(full_name, phone)')
            .eq('student_id', studentId)

        // School name/logo
        let schoolName = ''
        let schoolLogo = ''
        if (studentRes.data?.school_id) {
            const { data: settings } = await db
                .from('school_settings')
                .select('name, logo_url')
                .eq('school_id', studentRes.data.school_id)
                .maybeSingle()
            const { data: school } = await db
                .from('schools')
                .select('name, logo_url')
                .eq('id', studentRes.data.school_id)
                .maybeSingle()
            schoolName = settings?.name || school?.name || ''
            schoolLogo = settings?.logo_url || school?.logo_url || ''
        }

        const studentData = studentRes.data
        const firstEnrollment = (studentData?.enrollments as any[])?.[0]
        const parentProfile = parentLinks?.[0]?.profiles as any

        return NextResponse.json({
            payments: paymentsRes.data || [],
            transactions: transactionsRes.data || [],
            studentDetails: {
                name: studentData?.full_name || '',
                className: firstEnrollment?.classes?.name || '',
                nni: studentData?.national_id || '',
                parentName: parentProfile?.full_name || '',
                parentPhone: parentProfile?.phone || '',
                schoolName,
                schoolLogo,
            },
            schoolId,
        })
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Erreur serveur' }, { status: 500 })
    }
}
