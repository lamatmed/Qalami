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
        const requestId = formData.get('requestId') as string
        const schoolId = formData.get('schoolId') as string

        if (!file || !requestId || !schoolId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const admin = createAdminClient()

        // Verify caller belongs to this school and has admin role
        const { data: callerProfile } = await admin
            .from('profiles')
            .select('school_id, role')
            .eq('id', user.id)
            .single()

        const ADMIN_ROLES = ['admin', 'super_admin', 'school_staff']
        if (!callerProfile || callerProfile.school_id !== schoolId || !ADMIN_ROLES.includes(callerProfile.role)) {
            return NextResponse.json({ error: 'Permission refusée' }, { status: 403 })
        }

        // Verify the request belongs to this school
        const { data: docRequest } = await admin
            .from('document_requests')
            .select('school_id')
            .eq('id', requestId)
            .single()

        if (!docRequest || docRequest.school_id !== schoolId) {
            return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })
        }

        // Ensure bucket exists
        const { data: bucket } = await admin.storage.getBucket('document-requests')
        if (!bucket) {
            await admin.storage.createBucket('document-requests', {
                public: false,
                fileSizeLimit: 52428800, // 50MB
            })
        }

        const buffer = await file.arrayBuffer()
        const fileExt = file.name.split('.').pop() || 'pdf'
        const filePath = `${schoolId}/${requestId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

        const { error: uploadError } = await admin.storage
            .from('document-requests')
            .upload(filePath, buffer, { contentType: file.type, upsert: true })

        if (uploadError) {
            return NextResponse.json({ error: uploadError.message }, { status: 500 })
        }

        // Generate signed URL (valid 30 days for parent to download)
        const { data: signed } = await admin.storage
            .from('document-requests')
            .createSignedUrl(filePath, 60 * 60 * 24 * 30)

        // Update the document_requests record
        const { error: dbError } = await admin
            .from('document_requests')
            .update({
                file_path: signed?.signedUrl ?? filePath,
                file_name: file.name,
                file_size_bytes: file.size,
                status: 'ready',
                fulfilled_by: user.id,
                fulfilled_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', requestId)

        if (dbError) {
            return NextResponse.json({ error: dbError.message }, { status: 500 })
        }

        // Notify the parent
        const { data: docReq } = await admin
            .from('document_requests')
            .select('parent_id, doc_type, custom_title, school_id')
            .eq('id', requestId)
            .single()

        if (docReq) {
            const docLabels: Record<string, string> = {
                attestation_scolarite: 'Attestation de scolarité',
                certificat_scolarite: 'Certificat de scolarité',
                bulletin: 'Bulletin scolaire',
                releve_notes: 'Relevé de notes',
                convention_stage: 'Convention de stage',
                autre: 'Autre',
            }
            const title = docReq.custom_title || docLabels[docReq.doc_type] || docReq.doc_type
            await admin.from('notifications').insert({
                user_id: docReq.parent_id,
                school_id: docReq.school_id,
                title: `Document prêt : ${title}`,
                message: 'Votre document est disponible. Vous pouvez le télécharger depuis votre espace.',
                type: 'success',
                action_url: '/parent/requests',
                is_read: false,
            })
        }

        return NextResponse.json({ success: true, signedUrl: signed?.signedUrl })
    } catch (err: any) {
        console.error('Upload request file error:', err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
