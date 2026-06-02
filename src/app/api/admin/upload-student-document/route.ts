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
        const studentId = formData.get('studentId') as string
        const docName = formData.get('docName') as string

        if (!file || !studentId || !docName) {
            return NextResponse.json({ error: 'Missing file, studentId or docName' }, { status: 400 })
        }

        const admin = createAdminClient()

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
        const filePath = `students/${studentId}/${docName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.${fileExt}`

        const { error: uploadError } = await admin.storage
            .from('documents')
            .upload(filePath, buffer, {
                contentType: file.type,
                upsert: true,
            })

        if (uploadError) {
            console.error('Admin upload failed:', uploadError)
            return NextResponse.json({ error: uploadError.message }, { status: 500 })
        }

        const { data: { publicUrl } } = admin.storage.from('documents').getPublicUrl(filePath)

        const { error: dbError } = await admin.from('student_documents').upsert({
            student_id: studentId,
            document_name: docName,
            file_url: publicUrl,
            file_type: fileExt.toUpperCase(),
            status: 'valid',
            uploaded_at: new Date().toISOString()
        }, {
            onConflict: 'student_id,document_name'
        })

        if (dbError) {
            console.error('DB save error:', dbError)
            return NextResponse.json({ publicUrl, warning: 'File uploaded but DB record failed' })
        }

        return NextResponse.json({ success: true, publicUrl })
    } catch (err: any) {
        console.error('Upload API error:', err)
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
    }
}
