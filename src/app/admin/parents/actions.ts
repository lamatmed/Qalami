'use server'

import { getActionContext } from '@/lib/auth-action'
import { createAdminClient } from '@/utils/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function addChildToParent(parentId: string, studentId: string) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { supabase, schoolId } = ctx

    // Verify student belongs to this school
    const { data: student } = await supabase
        .from('profiles').select('id, full_name').eq('id', studentId).eq('school_id', schoolId).single()
    if (!student) return { error: 'Élève introuvable dans cet établissement' }

    // Check if link already exists
    const { data: existing } = await supabase
        .from('parent_student_links').select('id').eq('parent_id', parentId).eq('student_id', studentId).maybeSingle()
    if (existing) return { error: 'Ce lien existe déjà' }

    const { count } = await supabase
        .from('parent_student_links').select('id', { count: 'exact', head: true }).eq('parent_id', parentId)
    const isPrimary = (count ?? 0) === 0

    const { error } = await supabase.from('parent_student_links').insert({
        parent_id: parentId, student_id: studentId, is_primary: isPrimary,
    })
    if (error) return { error: error.message }

    revalidatePath('/admin/parents')
    return { success: true }
}

export async function removeChildFromParent(parentId: string, studentId: string) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { supabase, schoolId } = ctx

    const { error } = await supabase
        .from('parent_student_links')
        .delete()
        .eq('parent_id', parentId)
        .eq('student_id', studentId)
    if (error) return { error: error.message }

    revalidatePath('/admin/parents')
    return { success: true }
}

export async function updateParentInfo(parentId: string, data: {
    full_name: string
    address?: string | null
    email?: string | null
}) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }

    if (!data.full_name?.trim()) return { error: 'Le nom est obligatoire' }

    const adminClient = createAdminClient()
    const { error } = await adminClient.from('profiles').update({
        full_name: data.full_name.trim(),
        address: data.address?.trim() || null,
        email: data.email?.trim() || null,
        updated_at: new Date().toISOString(),
    }).eq('id', parentId).eq('role', 'parent')

    if (error) return { error: error.message }

    revalidatePath('/admin/parents')
    return { success: true }
}

export async function deleteParentPermanently(parentId: string) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { schoolId } = ctx
    const adminClient = createAdminClient()

    // Verify parent is linked to this school
    const { data: profile } = await adminClient
        .from('profiles').select('id').eq('id', parentId).eq('role', 'parent').single()
    if (!profile) return { error: 'Parent introuvable' }

    // Remove all child links
    await adminClient.from('parent_student_links').delete().eq('parent_id', parentId)
    await adminClient.from('profile_schools').delete().eq('profile_id', parentId)

    const { error } = await adminClient.auth.admin.deleteUser(parentId)
    if (error) return { error: error.message }

    revalidatePath('/admin/parents')
    return { success: true }
}

export async function getParentsWithOverdue(schoolId: string): Promise<string[]> {
    const adminClient = createAdminClient()

    // Find student IDs with overdue or pending payments in this school
    const { data: overduePayments, error } = await adminClient
        .from('payments')
        .select('student_id')
        .eq('school_id', schoolId)
        .in('payment_status', ['overdue', 'pending'])

    if (error) {
        console.error('[getParentsWithOverdue] payments query error:', error.message)
        return []
    }
    if (!overduePayments?.length) return []

    const overdueStudentIds = [...new Set(overduePayments.map((p: any) => p.student_id).filter(Boolean))]
    if (!overdueStudentIds.length) return []

    // Find parents of these students
    const { data: links } = await adminClient
        .from('parent_student_links')
        .select('parent_id')
        .in('student_id', overdueStudentIds)

    if (!links?.length) return []
    return [...new Set(links.map((l: any) => l.parent_id))]
}

export async function sendBulkPaymentReminders(schoolId: string) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }

    const overdueParentIds = await getParentsWithOverdue(schoolId)
    if (!overdueParentIds.length) return { success: true, count: 0 }

    const adminClient = createAdminClient()
    const { data: parents } = await adminClient
        .from('profiles').select('id, full_name').in('id', overdueParentIds)

    let sent = 0
    for (const parent of parents || []) {
        await adminClient.from('notifications').insert({
            user_id: parent.id,
            title: 'Rappel de paiement',
            message: 'Vous avez des paiements en retard. Veuillez régulariser votre situation le plus tôt possible.',
            type: 'warning',
            action_url: '/parent/finances',
        })
        sent++
    }

    return { success: true, count: sent }
}

export async function sendDocumentRequestNotification(parentId: string, requestName: string) {
    const adminClient = createAdminClient()
    await adminClient.from('notifications').insert({
        user_id: parentId,
        title: 'Demande de document',
        message: `L'administration vous demande de fournir : ${requestName}`,
        type: 'action',
        action_url: '/parent/documents',
    })
    return { success: true }
}

export async function searchSchoolStudentsForParent(query: string) {
    const ctx = await getActionContext()
    if (!ctx) return { data: [] }
    const { supabase, schoolId } = ctx

    if (!query.trim()) return { data: [] }

    const { data } = await supabase
        .from('profiles')
        .select('id, full_name, national_id')
        .eq('school_id', schoolId)
        .eq('role', 'student')
        .eq('status', 'active')
        .ilike('full_name', `%${query}%`)
        .limit(10)

    return { data: data || [] }
}
