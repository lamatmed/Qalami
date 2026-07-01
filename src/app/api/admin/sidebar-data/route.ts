import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { session } } = await supabase.auth.getSession()
        const user = session?.user
        if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

        const adminClient = createAdminClient()

        const { data: profile } = await adminClient
            .from('profiles')
            .select('school_id, role, full_name, avatar_url')
            .eq('id', user.id)
            .maybeSingle()

        if (!profile?.school_id) return NextResponse.json({ error: 'no_school' }, { status: 403 })

        const schoolId = profile.school_id

        // Run independent queries in parallel — each wrapped so one failure doesn't block others
        const [yearRes, termRes, settingsRes, schoolRes, studentsRes, enrolledRes, notifRes, reqRes] = await Promise.all([
            adminClient.from('academic_years').select('name').eq('school_id', schoolId).eq('is_current', true).maybeSingle(),
            adminClient.from('terms').select('name').eq('school_id', schoolId).eq('is_current', true).maybeSingle(),
            adminClient.from('school_settings').select('name, logo_url').eq('school_id', schoolId).maybeSingle(),
            adminClient.from('schools').select('name, logo_url').eq('id', schoolId).maybeSingle(),
            adminClient.from('profiles').select('id').eq('school_id', schoolId).eq('role', 'student').eq('status', 'active'),
            adminClient.from('enrollments').select('student_id').eq('school_id', schoolId).eq('status', 'active'),
            adminClient.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false),
            adminClient.from('document_requests').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'pending'),
        ])

        const enrolledSet = new Set((enrolledRes.data || []).map((e: any) => e.student_id))
        const unassignedStudents = (studentsRes.data || []).filter((s: any) => !enrolledSet.has(s.id)).length

        const schoolName = (settingsRes.data as any)?.name || (schoolRes.data as any)?.name || null
        const schoolLogo = (settingsRes.data as any)?.logo_url || (schoolRes.data as any)?.logo_url || null

        let staffPermissions: string[] | null = null
        if (profile.role === 'school_staff') {
            const { data: permsData } = await adminClient
                .from('staff_permissions')
                .select('permissions')
                .eq('user_id', user.id)
                .maybeSingle()
            staffPermissions = (permsData as any)?.permissions || []
        }

        const name = profile.full_name || 'Admin'
        return NextResponse.json({
            userInfo: {
                name,
                role: profile.role || 'admin',
                initials: name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2),
                avatar: (profile as any).avatar_url || null,
            },
            currentYear: (yearRes.data as any)?.name ?? null,
            currentTerm: (termRes.data as any)?.name ?? null,
            schoolName,
            schoolLogo,
            unassignedStudents,
            unreadNotifications: (notifRes.count || 0) + (reqRes.count || 0),
            pendingRequests: reqRes.count || 0,
            staffPermissions,
        })
    } catch (err: any) {
        console.error('[/api/admin/sidebar-data]', err)
        return NextResponse.json({ error: err?.message || 'Erreur serveur' }, { status: 500 })
    }
}
