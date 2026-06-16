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

        // Verify caller has admin role
        const { data: callerProfile } = await admin
            .from('profiles')
            .select('school_id, role')
            .eq('id', user.id)
            .single()

        const ADMIN_ROLES = ['admin', 'super_admin', 'school_staff']
        if (!callerProfile || !ADMIN_ROLES.includes(callerProfile.role)) {
            return NextResponse.json({ error: 'Permission refusée' }, { status: 403 })
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
                return NextResponse.json({ error: "Upload échoué" }, { status: 500 })
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
                return NextResponse.json({ error: "Erreur base de données" }, { status: 500 })
            }

            // Send notification to the parent
            try {
                const isNameAr = /[\u0600-\u06FF]/.test(name)
                const isBulletin = name.toLowerCase().includes('bulletin') || name.includes('كشف')
                
                const title = isBulletin
                    ? (isNameAr ? 'كشف النقاط متوفر' : 'Bulletin scolaire disponible')
                    : (isNameAr ? 'وثيقة جديدة متوفرة' : 'Nouveau document disponible')
                    
                const message = isBulletin
                    ? (isNameAr ? `كشف النقاط الخاص بطفلكم متوفر الآن: ${name}` : `Le bulletin scolaire de votre enfant est disponible : ${name}`)
                    : (isNameAr ? `تم إضافة وثيقة جديدة في حسابكم: ${name}` : `Un nouveau document a été ajouté à votre espace : ${name}`)

                await admin.from('notifications').insert({
                    user_id: parentId,
                    school_id: schoolId,
                    title,
                    message,
                    type: 'info',
                    action_url: '/parent/documents',
                    is_read: false,
                })
            } catch (notifErr) {
                console.error('Failed to insert parent upload notification:', notifErr)
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
                return NextResponse.json({ error: "Upload échoué" }, { status: 500 })
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
                return NextResponse.json({ error: "Erreur base de données" }, { status: 500 })
            }

            // Send notification to the parent
            try {
                const { data: docRecord } = await admin
                    .from('parent_documents')
                    .select('school_id')
                    .eq('id', docId)
                    .single()

                if (docRecord) {
                    const isNameAr = /[\u0600-\u06FF]/.test(docName)
                    const title = isNameAr ? `تم توفير المستند المطلوب : ${docName}` : `Document disponible : ${docName}`
                    const message = isNameAr 
                        ? `المستند المطلوب "${docName}" متوفر الآن في حسابكم.`
                        : `Le document demandé "${docName}" est désormais disponible dans votre espace.`

                    await admin.from('notifications').insert({
                        user_id: parentId,
                        school_id: docRecord.school_id,
                        title,
                        message,
                        type: 'success',
                        action_url: '/parent/documents',
                        is_read: false,
                    })
                }
            } catch (notifErr) {
                console.error('Failed to insert parent fulfill notification:', notifErr)
            }

            return NextResponse.json({ success: true, publicUrl })
        }

        return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
    } catch (err: any) {
        console.error('Upload API error:', err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
