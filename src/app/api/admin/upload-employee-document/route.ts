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
        const employeeId = formData.get('employeeId') as string
        const category = formData.get('category') as string

        if (!file || !employeeId || !category) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const admin = createAdminClient()

        const { data: bucketData } = await admin.storage.getBucket('documents')
        if (!bucketData) {
            await admin.storage.createBucket('documents', {
                public: true,
                allowedMimeTypes: [
                    'image/png', 'image/jpeg', 'image/webp',
                    'application/pdf',
                    'application/msword',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                ],
                fileSizeLimit: 20971520,
            })
        }

        const buffer = await file.arrayBuffer()
        const fileExt = file.name.split('.').pop() || 'pdf'
        const filePath = `staff/${employeeId}/${category}_${Date.now()}.${fileExt}`

        const { error: uploadError } = await admin.storage
            .from('documents')
            .upload(filePath, buffer, { contentType: file.type, upsert: true })

        if (uploadError) {
            return NextResponse.json({ error: uploadError.message }, { status: 500 })
        }

        const { data: { publicUrl } } = admin.storage.from('documents').getPublicUrl(filePath)

        return NextResponse.json({ success: true, publicUrl })
    } catch (err: any) {
        console.error('Upload employee document error:', err)
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
    }
}
