import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

const BUCKET = 'justifications'

export async function GET(_req: Request, { params }: { params: Promise<{ studentId: string }> }) {
    try {
        const { studentId } = await params

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

        const db = createAdminClient()

        const { data: adminProfile } = await db
            .from('profiles').select('school_id').eq('id', user.id).maybeSingle()
        if (!adminProfile?.school_id) return NextResponse.json({ error: 'no_school' }, { status: 403 })
        const schoolId = adminProfile.school_id

        // Attendance records
        const { data: records } = await db
            .from('attendance')
            .select(`
                id, date, status, justified, justification_note, justification_file_url,
                justification_status, justification_reviewed_by, justification_review_note,
                justification_attachment_url,
                subjects ( name_fr ),
                recorder:profiles!attendance_recorded_by_fkey ( full_name )
            `)
            .eq('student_id', studentId)
            .eq('school_id', schoolId)
            .order('date', { ascending: false })

        // Bucket files
        const { data: bucketFiles } = await db.storage.from(BUCKET).list(studentId, { limit: 200 })
        const files: any[] = []
        for (const f of bucketFiles || []) {
            const fullPath = `${studentId}/${f.name}`
            const { data: signed } = await db.storage.from(BUCKET).createSignedUrl(fullPath, 3600)
            if (signed?.signedUrl) {
                files.push({
                    name: f.name,
                    publicUrl: signed.signedUrl,
                    createdAt: f.created_at || null,
                })
            }
        }

        // Signed URLs for parent-uploaded attachments
        const enriched = await Promise.all((records || []).map(async (r: any) => {
            let attachSigned: string | null = null
            let attachFilename: string | null = null
            if (r.justification_attachment_url) {
                const { data: s } = await db.storage.from(BUCKET).createSignedUrl(r.justification_attachment_url, 3600)
                attachSigned = s?.signedUrl || null
                attachFilename = (r.justification_attachment_url as string).split('/').pop() || null
            }
            return {
                id: r.id,
                date: r.date,
                status: r.status,
                justified: r.justified,
                justification_note: r.justification_note,
                justification_file_url: r.justification_file_url || null,
                justification_status: r.justification_status ?? null,
                justification_reviewed_by: r.justification_reviewed_by ?? null,
                justification_review_note: r.justification_review_note ?? null,
                justification_attachment_signed_url: attachSigned,
                justification_attachment_filename: attachFilename,
                subjects: r.subjects,
                recorder: r.recorder,
            }
        }))

        return NextResponse.json({ records: enriched, files })
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Erreur serveur' }, { status: 500 })
    }
}
