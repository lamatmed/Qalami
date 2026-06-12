import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

export async function DELETE(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { docId } = await req.json()
        if (!docId) return NextResponse.json({ error: 'Missing docId' }, { status: 400 })

        const admin = createAdminClient()

        // Verify ownership before deleting
        const { data: existing } = await admin
            .from('documents')
            .select('id, file_url')
            .or(`teacher_id.eq.${user.id},uploaded_by.eq.${user.id}`)
            .eq('id', docId)
            .single()

        if (!existing) return NextResponse.json({ error: 'Document non trouvé ou non autorisé' }, { status: 403 })

        // Best-effort: delete file from storage
        if (existing.file_url) {
            try {
                const match = new URL(existing.file_url).pathname.match(/\/object\/public\/([^/]+)\/(.+)$/)
                if (match) await admin.storage.from(match[1]).remove([match[2]])
            } catch {}
        }

        const { error: dbError } = await admin.from('documents').delete().eq('id', docId)
        if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

        return NextResponse.json({ success: true })
    } catch (err: any) {
        console.error('[delete-document]', err)
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
    }
}

export async function PUT(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const formData = await req.formData()
        const docId       = formData.get('docId') as string
        const documentType = formData.get('documentType') as string
        const classId     = formData.get('classId') as string | null
        const subjectId   = formData.get('subjectId') as string | null
        const file        = formData.get('file') as File | null

        if (!docId) return NextResponse.json({ error: 'Missing docId' }, { status: 400 })

        const admin = createAdminClient()

        // Verify the document belongs to this teacher
        const { data: existing } = await admin
            .from('documents')
            .select('id, file_url, school_id, class_id')
            .or(`teacher_id.eq.${user.id},uploaded_by.eq.${user.id}`)
            .eq('id', docId)
            .single()

        if (!existing) return NextResponse.json({ error: 'Document non trouvé ou non autorisé' }, { status: 403 })

        const updatePayload: Record<string, unknown> = {
            document_type: documentType,
            subject_id: (subjectId && subjectId !== 'none') ? subjectId : null,
            class_id:   (classId   && classId   !== 'none') ? classId   : null,
            updated_at: new Date().toISOString(),
        }

        // Resolve school_id if class changed
        let resolvedSchoolId = existing.school_id
        if (classId && classId !== 'none' && classId !== existing.class_id) {
            const { data: cls } = await admin.from('classes').select('school_id').eq('id', classId).single()
            if (cls?.school_id) resolvedSchoolId = cls.school_id
        }

        if (file && file.size > 0) {
            // Upload the new file
            const fileExt  = file.name.split('.').pop() || 'pdf'
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
            const filePath = `school_${resolvedSchoolId}/${documentType}/${Date.now()}_${safeName}`

            const buffer = await file.arrayBuffer()
            const { error: uploadError } = await admin.storage
                .from('documents')
                .upload(filePath, buffer, { contentType: file.type, upsert: false })

            if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

            const { data: { publicUrl } } = admin.storage.from('documents').getPublicUrl(filePath)

            // Best-effort: delete old file from storage
            if (existing.file_url) {
                try {
                    const match = new URL(existing.file_url).pathname.match(/\/object\/public\/([^/]+)\/(.+)$/)
                    if (match) await admin.storage.from(match[1]).remove([match[2]])
                } catch {}
            }

            updatePayload.name            = file.name
            updatePayload.file_url        = publicUrl
            updatePayload.file_type       = fileExt.toUpperCase()
            updatePayload.file_size_bytes = file.size
            updatePayload.school_id       = resolvedSchoolId
        }

        const { error: dbError } = await admin
            .from('documents')
            .update(updatePayload)
            .eq('id', docId)

        if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

        return NextResponse.json({ success: true, newName: updatePayload.name ?? null, newUrl: updatePayload.file_url ?? null })
    } catch (err: any) {
        console.error('[update-document]', err)
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
    }
}
