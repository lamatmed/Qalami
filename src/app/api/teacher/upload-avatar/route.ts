import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

export async function POST(req: NextRequest) {
    try {
        // 1. Verify user is authenticated
        const supabase = await createClient()
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // 2. Extract file from multipart form data
        const formData = await req.formData()
        const file = formData.get('file') as File

        if (!file) {
            return NextResponse.json({ error: 'Missing file' }, { status: 400 })
        }

        // Initialize Admin Client to ensure we bypass storage policy limits
        const admin = createAdminClient()

        // 3. Ensure images_avatars bucket exists and is public
        const bucketName = 'images_avatars'
        const { data: bucketData } = await admin.storage.getBucket(bucketName)
        if (!bucketData) {
            await admin.storage.createBucket(bucketName, {
                public: true,
                allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'],
                fileSizeLimit: 2097152 // 2MB max
            })
        } else {
            await admin.storage.updateBucket(bucketName, {
                public: true,
                allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'],
                fileSizeLimit: 2097152
            })
        }

        // 4. Build file path and prepare upload
        const buffer = await file.arrayBuffer()
        const fileExt = file.name.split('.').pop() || 'png'
        const filePath = `${user.id}/avatar_${Date.now()}.${fileExt}`

        // 5. Direct upload as Admin bypassing user-bound storage row policies
        const { error: uploadError } = await admin.storage
            .from(bucketName)
            .upload(filePath, buffer, {
                contentType: file.type,
                upsert: true,
            })

        if (uploadError) {
            console.error('Avatar upload error:', uploadError)
            return NextResponse.json({ error: uploadError.message }, { status: 500 })
        }

        // 6. Get the public URL for the uploaded avatar
        const { data: { publicUrl } } = admin.storage
            .from(bucketName)
            .getPublicUrl(filePath)

        return NextResponse.json({ success: true, publicUrl })
    } catch (err: any) {
        console.error('Avatar API Route panicked:', err)
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
    }
}
