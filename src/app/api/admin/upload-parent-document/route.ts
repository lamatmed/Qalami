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
        const mode = formData.get('mode') as string // 'upload' | 'fulfill'
        const file = formData.get('file') as File
        const parentId = formData.get('parentId') as string

        if (!file || !parentId || !mode) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const admin = createAdminClient()

        const { data: bucketData } = await admin.storage.getBucket('documents')
        if (!bucketData) {
            await admin.storage.createBucket('documents', {
                public: true,
                allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
                fileSizeLimit: 20971520 // 20MB
            })
        }

        const buffer = await file.arrayBuffer()
        const ext = file.name.split('.').pop() || 'pdf'

        if (mode === 'upload') {
            const schoolId = formData.get('schoolId') as string
            const name = formData.get('name') as string
            const description = formData.get('description') as string | null

            if (!schoolId || !name) {
                return NextResponse.json({ error: 'Missing schoolId or name' }, { status: 400 })
            }

            const safeName = name.replace(/[^a-zA-Z0-9]/g, '_')
            const filePath = `parents/${parentId}/${safeName}_${Date.now()}.${ext}`

            const { error: storageErr } = await admin.storage
                .from('documents')
                .upload(filePath, buffer, { contentType: file.type, upsert: true })

            if (storageErr) {
                return NextResponse.json({ error: storageErr.message }, { status: 500 })
            }

            const { data: { publicUrl } } = admin.storage.from('documents').getPublicUrl(filePath)

            const { error: dbErr } = await admin.from('parent_documents').insert({
                school_id: schoolId,
                parent_id: parentId,
                name: name.trim(),
                description: description?.trim() || null,
                file_url: publicUrl,
                file_type: ext.toUpperCase(),
                file_size: file.size,
                uploaded_by: 'admin',
                is_request: false,
                request_status: null,
            })

            if (dbErr) {
                return NextResponse.json({ error: dbErr.message }, { status: 500 })
            }

            return NextResponse.json({ success: true, publicUrl })
        }

        if (mode === 'fulfill') {
            const docId = formData.get('docId') as string
            const docName = formData.get('docName') as string

            if (!docId || !docName) {
                return NextResponse.json({ error: 'Missing docId or docName' }, { status: 400 })
            }

            const safeName = docName.replace(/[^a-zA-Z0-9]/g, '_')
            const filePath = `parents/${parentId}/${safeName}_response_${Date.now()}.${ext}`

            const { error: storageErr } = await admin.storage
                .from('documents')
                .upload(filePath, buffer, { contentType: file.type, upsert: true })

            if (storageErr) {
                return NextResponse.json({ error: storageErr.message }, { status: 500 })
            }

            const { data: { publicUrl } } = admin.storage.from('documents').getPublicUrl(filePath)

            const { error: dbErr } = await admin
                .from('parent_documents')
                .update({
                    file_url: publicUrl,
                    file_type: ext.toUpperCase(),
                    file_size: file.size,
                    request_status: 'fulfilled',
                })
                .eq('id', docId)

            if (dbErr) {
                return NextResponse.json({ error: dbErr.message }, { status: 500 })
            }

            return NextResponse.json({ success: true, publicUrl })
        }

        return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
    } catch (err: any) {
        console.error('Upload API error:', err)
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
    }
}
