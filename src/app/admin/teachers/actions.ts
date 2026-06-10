'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { getActionContext } from '@/lib/auth-action'
import { revalidatePath } from 'next/cache'

export async function saveTeacherContractAction(payload: {
    teacherId: string
    contractId: string | null
    contractType: 'fixed' | 'hourly'
    salary: number
    position: string
    paymentMethod?: string
    bankName?: string
    accountNumber?: string
    walletApp?: string
    walletPhone?: string
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Non authentifié' }

    const { data: me } = await supabase
        .from('profiles')
        .select('school_id')
        .eq('id', user.id)
        .single()

    if (!me?.school_id) return { error: 'École introuvable' }

    const admin = createAdminClient()

    const baseRow = {
        school_id: me.school_id,
        employee_id: payload.teacherId,
        contract_type: payload.contractType === 'fixed' ? 'CDI' : 'hourly',
        position: payload.position || 'Enseignant',
        monthly_salary: payload.salary,
        start_date: new Date().toISOString().split('T')[0],
        status: 'active',
    }
    // Try with payment fields; fall back to base if columns don't exist
    const row: Record<string, unknown> = {
        ...baseRow,
        payment_method: payload.paymentMethod || 'bank',
        bank_name: payload.bankName || null,
        account_number: payload.accountNumber || null,
        wallet_app: payload.walletApp || null,
        wallet_phone: payload.walletPhone || null,
    }

    const tryUpsert = async (data: Record<string, unknown>) => {
        if (payload.contractId) {
            return admin.from('contracts').update(data).eq('id', payload.contractId).eq('school_id', me.school_id)
        } else {
            return admin.from('contracts').insert(data).select('id').single()
        }
    }

    let result = await tryUpsert(row)

    let isFallback = false
    // If payment columns don't exist yet, retry with base fields only
    if (result.error && result.error.message?.includes('column')) {
        console.warn(
            "[saveTeacherContractAction] Warning: falling back to base fields because payment columns do not exist. " +
            "Please apply migration '20260601_contracts_payment_method.sql' to your database.",
            result.error
        )
        result = await tryUpsert(baseRow)
        isFallback = true
    }

    if (result.error) return { error: result.error.message }
    const contractId = payload.contractId ?? (result.data as any)?.id
    return { success: true, contractId, warning: isFallback ? 'missing_columns' : undefined }
}

export async function loadTeacherContractAction(teacherId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Non authentifié' }

    const { data: me } = await supabase
        .from('profiles')
        .select('school_id')
        .eq('id', user.id)
        .single()

    if (!me?.school_id) return { error: 'École introuvable' }

    const admin = createAdminClient()

    // Try to load with payment fields first; fall back if columns don't exist yet
    let contract: any = null
    const { data: withPayment, error: err1 } = await admin
        .from('contracts')
        .select('id, contract_type, position, monthly_salary, payment_method, bank_name, account_number, wallet_app, wallet_phone')
        .eq('employee_id', teacherId)
        .eq('school_id', me.school_id)
        .eq('status', 'active')
        .maybeSingle()

    let warning: string | undefined = undefined
    if (err1) {
        console.warn(
            "[loadTeacherContractAction] Warning: falling back to base fields because payment columns do not exist. " +
            "Please apply migration '20260601_contracts_payment_method.sql' to your database.",
            err1
        )
        const { data: base, error: err2 } = await admin
            .from('contracts')
            .select('id, contract_type, position, monthly_salary')
            .eq('employee_id', teacherId)
            .eq('school_id', me.school_id)
            .eq('status', 'active')
            .maybeSingle()
        if (err2) return { error: err2.message }
        contract = base
        warning = 'missing_columns'
    } else {
        contract = withPayment
    }

    return { contract: contract ?? null, warning }
}

// ── Fix edit document (bypasses RLS) ────────────────────────────────────────
export async function updateTeacherDocumentAction(id: string, name: string, documentType: string, fileUrl?: string) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const admin = createAdminClient()
    const update: Record<string, unknown> = { name: name.trim(), document_type: documentType }
    if (fileUrl) update.file_url = fileUrl
    const { error } = await admin.from('documents').update(update).eq('id', id)
    if (error) return { error: error.message }
    return { success: true }
}

// ── Fix delete document (bypasses RLS) ──────────────────────────────────────
export async function deleteTeacherDocumentAction(id: string) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const admin = createAdminClient()
    const { error } = await admin.from('documents').delete().eq('id', id)
    if (error) return { error: error.message }
    return { success: true }
}

// ── Save / fetch admin documents ─────────────────────────────────────────────
export async function saveAdminDocumentAction(teacherId: string, docType: string, fileUrl: string, fileName: string, fileSize: number) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { schoolId, userId } = ctx
    const admin = createAdminClient()
    const { data: existing } = await admin
        .from('documents').select('id').eq('teacher_id', teacherId).eq('school_id', schoolId).eq('category', docType).maybeSingle()
    if (existing) {
        await admin.from('documents').update({ file_url: fileUrl, name: fileName, file_size_bytes: fileSize, updated_at: new Date().toISOString() }).eq('id', existing.id)
    } else {
        await admin.from('documents').insert({
            teacher_id: teacherId, school_id: schoolId, name: fileName,
            file_url: fileUrl, document_type: 'general', category: docType,
            file_size_bytes: fileSize, uploaded_by: userId,
        })
    }
    return { success: true }
}

export async function fetchAdminDocumentsAction(teacherId: string) {
    const ctx = await getActionContext()
    if (!ctx) return { data: [] }
    const { schoolId } = ctx
    const admin = createAdminClient()
    const { data } = await admin
        .from('documents')
        .select('id, name, file_url, file_size_bytes, category, created_at')
        .eq('teacher_id', teacherId)
        .eq('school_id', schoolId)
        .in('category', ['cv', 'contract', 'diploma', 'medical'])
    return { data: data || [] }
}

// ── Delete teacher permanently ────────────────────────────────────────────────
export async function deleteTeacherPermanently(teacherId: string) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { schoolId } = ctx
    const admin = createAdminClient()
    const { data: profile } = await admin.from('profiles').select('id').eq('id', teacherId).eq('school_id', schoolId).eq('role', 'teacher').single()
    if (!profile) return { error: 'Enseignant introuvable dans cet établissement' }
    await admin.from('profile_schools').delete().eq('profile_id', teacherId)
    const { error } = await admin.auth.admin.deleteUser(teacherId)
    if (error) return { error: error.message }
    revalidatePath('/admin/teachers')
    return { success: true }
}

// ── Update teacher info ───────────────────────────────────────────────────────
export async function updateTeacherInfoAction(teacherId: string, data: {
    full_name: string; email?: string | null; nni?: string | null; address?: string | null
}) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    if (!data.full_name?.trim()) return { error: 'Le nom est obligatoire' }
    const admin = createAdminClient()
    const { error } = await admin.from('profiles').update({
        full_name: data.full_name.trim(),
        email: data.email?.trim() || null,
        national_id: data.nni?.trim() || null,
        address: data.address?.trim() || null,
        updated_at: new Date().toISOString(),
    }).eq('id', teacherId).eq('role', 'teacher')
    if (error) return { error: error.message }
    revalidatePath('/admin/teachers')
    return { success: true }
}

// ── Edit / delete absence ─────────────────────────────────────────────────────
export async function addTeacherAbsenceAction(data: {
    teacherId: string
    schoolId: string
    date: string
    status: 'absent' | 'late'
    justified: boolean
    justificationNote?: string | null
    hours?: number | null
}) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const admin = createAdminClient()
    const noteWithHours = data.hours
        ? `[h:${data.hours}]${data.justificationNote ? ' ' + data.justificationNote : ''}`
        : (data.justificationNote || null)
    const { error } = await (admin.from as any)('teacher_attendance').insert({
        teacher_id: data.teacherId,
        school_id: data.schoolId,
        date: data.date,
        status: data.status,
        justified: data.justified,
        justification_note: noteWithHours,
        made_up: false,
        recorded_by: ctx.userId,
    })
    if (error) return { error: error.message }
    return { success: true }
}

export async function updateTeacherAbsenceAction(id: string, data: {
    date: string; status: string; justified: boolean; justification_note?: string | null
}) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const admin = createAdminClient()
    const { error } = await admin.from('teacher_attendance').update({
        date: data.date, status: data.status, justified: data.justified,
        justification_note: data.justification_note || null,
    }).eq('id', id)
    if (error) return { error: error.message }
    return { success: true }
}

export async function deleteTeacherAbsenceAction(id: string) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const admin = createAdminClient()
    const { error } = await admin.from('teacher_attendance').delete().eq('id', id)
    if (error) return { error: error.message }
    return { success: true }
}

export async function removeTeacherJustificationAction(id: string) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const admin = createAdminClient()
    const { error } = await (admin.from as any)('teacher_attendance')
        .update({ justified: false, justification_note: null })
        .eq('id', id)
    if (error) return { error: error.message }
    return { success: true }
}

export async function justifyTeacherAbsenceAction(
    id: string,
    note: string | null,
    isAuto: boolean,
    autoData?: { teacherId: string; schoolId: string; date: string; className?: string }
) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const admin = createAdminClient()

    if (isAuto && autoData) {
        const { error } = await (admin.from as any)('teacher_attendance').insert({
            teacher_id: autoData.teacherId,
            school_id: autoData.schoolId,
            date: autoData.date,
            status: 'absent',
            justified: true,
            justification_note: note || `Appel non fait (justifié) : ${autoData.className || ''}`,
            recorded_by: ctx.userId,
            made_up: false,
        })
        if (error) return { error: error.message }
    } else {
        const { error } = await (admin.from as any)('teacher_attendance')
            .update({ justified: true, justification_note: note || null })
            .eq('id', id)
        if (error) return { error: error.message }
    }
    return { success: true }
}
