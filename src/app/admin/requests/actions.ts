'use server'

import { getActionContext } from '@/lib/auth-action'
import { createAdminClient } from '@/utils/supabase/admin'
import { DOC_TYPE_LABELS } from './constants'

export type DocRequestStatus = 'pending' | 'in_progress' | 'ready' | 'rejected' | 'cancelled'
export type DocType =
    | 'attestation_scolarite'
    | 'certificat_scolarite'
    | 'bulletin'
    | 'releve_notes'
    | 'convention_stage'
    | 'autre'

export interface DocumentRequest {
    id: string
    school_id: string
    parent_id: string
    student_id: string
    doc_type: DocType
    custom_title: string | null
    notes: string | null
    status: DocRequestStatus
    response_note: string | null
    file_path: string | null
    file_name: string | null
    file_size_bytes: number | null
    fulfilled_by: string | null
    fulfilled_at: string | null
    created_at: string
    updated_at: string
    parent: { full_name: string | null; avatar_url: string | null } | null
    student: { full_name: string | null; national_id: string | null } | null
}

export async function getMySchoolId(): Promise<string | null> {
    const ctx = await getActionContext()
    return ctx?.schoolId ?? null
}

export async function getDocumentRequests(status?: DocRequestStatus) {
    const ctx = await getActionContext()
    if (!ctx) return { data: [], error: 'Non authentifié' }
    const admin = createAdminClient()

    let query = admin
        .from('document_requests')
        .select(`
            *,
            parent:profiles!document_requests_parent_id_fkey ( full_name, avatar_url ),
            student:profiles!document_requests_student_id_fkey ( full_name, national_id )
        `)
        .eq('school_id', ctx.schoolId)
        .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) return { data: [], error: error.message }
    return { data: (data || []) as DocumentRequest[], error: null }
}

export async function getPendingRequestsCount() {
    const ctx = await getActionContext()
    if (!ctx) return 0
    const admin = createAdminClient()
    const { count } = await admin
        .from('document_requests')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', ctx.schoolId)
        .eq('status', 'pending')
    return count || 0
}

export async function updateDocRequestStatus(
    requestId: string,
    status: DocRequestStatus,
    responseNote?: string
) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const admin = createAdminClient()

    const updates: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
    }
    if (responseNote !== undefined) updates.response_note = responseNote
    if (status === 'ready' || status === 'rejected') {
        updates.fulfilled_by = ctx.userId
        updates.fulfilled_at = new Date().toISOString()
    }

    const { error } = await admin
        .from('document_requests')
        .update(updates)
        .eq('id', requestId)
        .eq('school_id', ctx.schoolId)

    if (error) return { error: error.message }

    // Notify the parent
    const { data: req } = await admin
        .from('document_requests')
        .select('parent_id, doc_type, custom_title')
        .eq('id', requestId)
        .single()

    if (req) {
        const docLabel = DOC_TYPE_LABELS[req.doc_type as DocType] ?? req.doc_type
        const title = req.custom_title || docLabel
        const statusText =
            status === 'ready'    ? 'prête à retirer' :
            status === 'rejected' ? 'refusée' :
            status === 'in_progress' ? 'en cours de traitement' : 'mise à jour'

        await admin.from('notifications').insert({
            user_id: req.parent_id,
            school_id: ctx.schoolId,
            title: `Demande ${statusText} : ${title}`,
            message: responseNote || `Votre demande de ${docLabel} a été ${statusText}.`,
            type: status === 'ready' ? 'success' : status === 'rejected' ? 'warning' : 'info',
            action_url: '/parent/requests',
            is_read: false,
        })
    }

    return { success: true }
}

export async function removeFileFromRequest(requestId: string) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const admin = createAdminClient()
    const { error } = await admin
        .from('document_requests')
        .update({
            file_path: null,
            file_name: null,
            file_size_bytes: null,
            status: 'in_progress',
            fulfilled_by: null,
            fulfilled_at: null,
            updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .eq('school_id', ctx.schoolId)
    if (error) return { error: error.message }
    return { success: true }
}

export async function attachFileToRequest(
    requestId: string,
    filePath: string,
    fileName: string,
    fileSizeBytes: number
) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const admin = createAdminClient()
    const { error } = await admin
        .from('document_requests')
        .update({
            file_path: filePath,
            file_name: fileName,
            file_size_bytes: fileSizeBytes,
            status: 'ready',
            fulfilled_by: ctx.userId,
            fulfilled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .eq('school_id', ctx.schoolId)
    if (error) return { error: error.message }
    return { success: true }
}

// ─── Parent-side submission ───────────────────────────────────────────────────

export async function submitDocumentRequest(params: {
    studentId: string
    docType: DocType
    customTitle?: string
    notes?: string
}) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const admin = createAdminClient()

    const { data: req, error } = await admin
        .from('document_requests')
        .insert({
            school_id: ctx.schoolId,
            parent_id: ctx.userId,
            student_id: params.studentId,
            doc_type: params.docType,
            custom_title: params.customTitle ?? null,
            notes: params.notes ?? null,
            status: 'pending',
        })
        .select('id')
        .single()

    if (error) return { error: error.message }

    // Notify all admins with parent name + student name
    const [{ data: admins }, { data: parentProfile }, { data: studentProfile }] = await Promise.all([
        admin.from('profiles').select('id').eq('school_id', ctx.schoolId).in('role', ['admin', 'super_admin', 'school_staff']),
        admin.from('profiles').select('full_name').eq('id', ctx.userId).single(),
        admin.from('profiles').select('full_name').eq('id', params.studentId).single(),
    ])

    if (admins?.length) {
        const docLabel = DOC_TYPE_LABELS[params.docType] ?? params.docType
        const parentName = (parentProfile as any)?.full_name ?? 'Parent'
        const studentName = (studentProfile as any)?.full_name ?? ''
        const msgStudent = studentName ? ` (élève : ${studentName})` : ''
        await admin.from('notifications').insert(
            admins.map(a => ({
                user_id: a.id,
                school_id: ctx.schoolId,
                title: 'Nouvelle demande de document',
                message: `${parentName} demande : ${docLabel}${msgStudent}`,
                type: 'action',
                action_url: '/admin/requests',
                event_type: 'parent_request',
                is_read: false,
            }))
        )
    }

    return { success: true, requestId: req?.id }
}

