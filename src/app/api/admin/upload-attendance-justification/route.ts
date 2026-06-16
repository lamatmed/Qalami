import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const formData = await req.formData()
        const file = formData.get('file') as File
        const attendanceId = formData.get('attendanceId') as string
        const studentId = formData.get('studentId') as string

        if (!file || !attendanceId || !studentId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const admin = createAdminClient()

        // Verify caller is the parent of the student OR an admin of the same school
        const { data: callerProfile } = await admin
            .from('profiles')
            .select('school_id, role')
            .eq('id', user.id)
            .single()

        const ADMIN_ROLES = ['admin', 'super_admin', 'school_staff']
        const isAdmin = callerProfile && ADMIN_ROLES.includes(callerProfile.role)

        if (!isAdmin) {
            // Must be a parent of the student
            const { data: parentLink } = await admin
                .from('parent_children')
                .select('student_id')
                .eq('parent_id', user.id)
                .eq('student_id', studentId)
                .maybeSingle()

            if (!parentLink) {
                return NextResponse.json({ error: 'Permission refusée' }, { status: 403 })
            }
        }

        const { data: bucketData } = await admin.storage.getBucket('documents')
        if (!bucketData) {
            await admin.storage.createBucket('documents', {
                public: true,
                allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'],
                fileSizeLimit: 10485760 // 10MB
            })
        }

        const buffer = await file.arrayBuffer()
        const fileExt = file.name.split('.').pop() || 'pdf'
        const filePath = `attendance/${studentId}/${attendanceId}_${Date.now()}.${fileExt}`

        const { error: uploadError } = await admin.storage
            .from('documents')
            .upload(filePath, buffer, { contentType: file.type, upsert: true })

        if (uploadError) {
            return NextResponse.json({ error: uploadError.message }, { status: 500 })
        }

        const { data: { publicUrl } } = admin.storage.from('documents').getPublicUrl(filePath)

        const { error: dbError } = await admin
            .from('attendance')
            .update({ justification_file_url: publicUrl })
            .eq('id', attendanceId)

        if (dbError) {
            return NextResponse.json({ error: dbError.message }, { status: 500 })
        }

        // Notify admins — fire-and-forget, don't block the response
        ;(async () => {
            try {
                const [{ data: parentProfile }, { data: studentProfile }, { data: attRow }] = await Promise.all([
                    admin.from('profiles').select('full_name').eq('id', user.id).single(),
                    admin.from('profiles').select('full_name').eq('id', studentId).single(),
                    admin.from('attendance').select('school_id').eq('id', attendanceId).single(),
                ])
                const schoolId = (attRow as any)?.school_id
                if (!schoolId) return
                const { data: admins } = await admin
                    .from('profiles').select('id')
                    .eq('school_id', schoolId)
                    .in('role', ['admin', 'super_admin', 'school_staff'])
                if (!admins?.length) return
                const parentName = (parentProfile as any)?.full_name ?? 'Parent'
                const studentName = (studentProfile as any)?.full_name ?? ''
                await admin.from('notifications').insert(
                    admins.map((a: any) => ({
                        user_id: a.id,
                        school_id: schoolId,
                        title: "Nouvelle justification d'absence",
                        message: `${parentName} a envoyé une justification pour : ${studentName}`,
                        type: 'action',
                        action_url: `/admin/students/${studentId}`,
                        event_type: 'absence_justification',
                        is_read: false,
                    }))
                )
            } catch { /* silent */ }
        })()

        return NextResponse.json({ success: true, publicUrl })
    } catch (err: any) {
        console.error('Upload API error:', err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
