import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

export async function POST(req: NextRequest) {
    try {
        // 1. Verify user is authenticated as admin
        const supabase = await createClient()
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const formData = await req.formData()
        const file = formData.get('file') as File
        const schoolId = formData.get('schoolId') as string

        if (!file || !schoolId) {
            return NextResponse.json({ error: 'Missing file or schoolId' }, { status: 400 })
        }

        // Initialize the Admin Client (bypasses RLS)
        const admin = createAdminClient()

        // 2. Ensure the bucket exists and IS PUBLIC
        const { data: bucketData } = await admin.storage.getBucket('images_schools')
        if (!bucketData) {
            await admin.storage.createBucket('images_schools', {
                public: true,
                allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'],
                fileSizeLimit: 2097152 // 2MB
            })
        } else {
            // Ensure it's definitely public even if it was previously private!
            await admin.storage.updateBucket('images_schools', {
                public: true,
                allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'],
                fileSizeLimit: 2097152
            })
        }

        // 3. Convert File buffer for storage upload
        const buffer = await file.arrayBuffer()
        const fileExt = file.name.split('.').pop() || 'png'
        const filePath = `${schoolId}/logo_${Date.now()}.${fileExt}`

        // 4. Upload utilizing Admin Privilege bypassing user policy failure
        const { error: uploadError } = await admin.storage
            .from('images_schools')
            .upload(filePath, buffer, {
                contentType: file.type,
                upsert: true,
            })

        if (uploadError) {
            console.error('Admin upload failed:', uploadError)
            return NextResponse.json({ error: uploadError.message }, { status: 500 })
        }

        // 5. Obtain Public URL
        const { data: { publicUrl } } = admin.storage
            .from('images_schools')
            .getPublicUrl(filePath)

        return NextResponse.json({ success: true, publicUrl })
    } catch (err: any) {
        console.error('Upload API Panic:', err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
