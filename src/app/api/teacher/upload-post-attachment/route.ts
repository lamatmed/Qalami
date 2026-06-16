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
        const classId = formData.get('classId') as string
        if (!file || !classId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

        const admin = createAdminClient()
        const buffer = await file.arrayBuffer()
        const filePath = `class-posts/${classId}/${Date.now()}_${file.name}`

        const { data: bucketData } = await admin.storage.getBucket('documents')
        if (!bucketData) {
            await admin.storage.createBucket('documents', {
                public: true,
                allowedMimeTypes: ['image/*', 'application/pdf', 'application/msword',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'application/vnd.ms-powerpoint',
                    'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
                fileSizeLimit: 20971520,
            })
        }

        const { error: uploadError } = await admin.storage
            .from('documents')
            .upload(filePath, buffer, { contentType: file.type, upsert: true })

        if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

        const { data: { publicUrl } } = admin.storage.from('documents').getPublicUrl(filePath)
        return NextResponse.json({ publicUrl, fileName: file.name, fileType: file.type })
    } catch (err: any) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
