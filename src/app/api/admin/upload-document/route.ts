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

        const { data: profile } = await supabase
            .from('profiles')
            .select('school_id')
            .eq('id', user.id)
            .single()

        if (!profile?.school_id) {
            return NextResponse.json({ error: 'No school context' }, { status: 403 })
        }

        const formData = await req.formData()
        const file = formData.get('file') as File
        const documentType = formData.get('documentType') as string
        const category = formData.get('category') as string
        const classId = formData.get('classId') as string | null
        const subjectId = formData.get('subjectId') as string | null
        const teacherId = formData.get('teacherId') as string | null
        const academicYear = formData.get('academicYear') as string | null
        const description = formData.get('description') as string | null

        if (!file || !documentType || !category) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const admin = createAdminClient()

        // Resolve school_id from class if provided, otherwise use profile school_id
        let resolvedSchoolId = profile.school_id
        if (classId && classId !== 'none') {
            const { data: cls } = await admin.from('classes').select('school_id').eq('id', classId).single()
            if (cls?.school_id) resolvedSchoolId = cls.school_id
        }

        const { data: bucketData } = await admin.storage.getBucket('documents')
        if (!bucketData) {
            await admin.storage.createBucket('documents', {
                public: true,
                allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
                fileSizeLimit: 20971520 // 20MB
            })
        }

        const buffer = await file.arrayBuffer()
        const fileExt = file.name.split('.').pop() || 'pdf'
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const filePath = `school_${resolvedSchoolId}/${documentType}/${Date.now()}_${safeName}`

        const { error: uploadError } = await admin.storage
            .from('documents')
            .upload(filePath, buffer, {
                contentType: file.type,
                upsert: false,
            })

        if (uploadError) {
            console.error('Admin upload failed:', uploadError)
            return NextResponse.json({ error: "Upload échoué" }, { status: 500 })
        }

        const { data: { publicUrl } } = admin.storage.from('documents').getPublicUrl(filePath)

        const { error: dbError } = await admin.from('documents').insert({
            school_id: resolvedSchoolId,
            name: file.name,
            file_url: publicUrl,
            file_type: fileExt.toUpperCase(),
            file_size_bytes: file.size,
            document_type: documentType,
            category: category,
            subject_id: (subjectId && subjectId !== 'none') ? subjectId : null,
            class_id: (classId && classId !== 'none') ? classId : null,
            teacher_id: (teacherId && teacherId !== 'none') ? teacherId : null,
            academic_year: academicYear || null,
            description: description?.trim() || null,
            uploaded_by: user.id,
        })

        if (dbError) {
            console.error('DB insert error:', dbError)
            return NextResponse.json({ error: "Erreur base de données" }, { status: 500 })
        }

        return NextResponse.json({ success: true, publicUrl })
    } catch (err: any) {
        console.error('Upload API error:', err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
