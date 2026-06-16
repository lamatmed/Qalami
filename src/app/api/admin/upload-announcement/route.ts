import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const formData = await req.formData()
        const file = formData.get('file') as File
        const schoolId = formData.get('schoolId') as string

        if (!file || !schoolId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

        const admin = createAdminClient()

        // Verify caller is admin of this school
        const { data: callerProfile } = await admin
            .from('profiles')
            .select('school_id, role')
            .eq('id', user.id)
            .single()

        const ADMIN_ROLES = ['admin', 'super_admin', 'school_staff']
        if (!callerProfile || !ADMIN_ROLES.includes(callerProfile.role) || callerProfile.school_id !== schoolId) {
            return NextResponse.json({ error: 'Permission refusée' }, { status: 403 })
        }

        const buffer = await file.arrayBuffer()
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const filePath = `announcements/${schoolId}/${Date.now()}_${safeName}`

        const { data: bucketData } = await admin.storage.getBucket('documents')
        if (!bucketData) {
            await admin.storage.createBucket('documents', {
                public: true,
                allowedMimeTypes: ['image/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
                fileSizeLimit: 20971520, // 20MB
            })
        }

        const { error: uploadError } = await admin.storage
            .from('documents')
            .upload(filePath, buffer, { contentType: file.type, upsert: true })

        if (uploadError) return NextResponse.json({ error: "Upload échoué" }, { status: 500 })

        const { data: { publicUrl } } = admin.storage.from('documents').getPublicUrl(filePath)
        return NextResponse.json({ publicUrl, fileName: file.name })
    } catch (err: any) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
