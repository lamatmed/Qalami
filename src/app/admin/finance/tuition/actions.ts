'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { getActionContext } from '@/lib/auth-action'

export async function searchStudentByNniAction(nni: string) {
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié', student: null, payments: [] }
    const { schoolId } = ctx
    const admin = createAdminClient()

    const { data: profile, error } = await admin
        .from('profiles')
        .select('id, full_name, phone, national_id')
        .eq('national_id', nni.trim())
        .eq('school_id', schoolId)
        .maybeSingle()

    if (error) return { error: error.message, student: null, payments: [] }
    if (!profile) return { error: null, student: null, payments: [] }

    const { data: payments } = await admin
        .from('payments')
        .select('id, payment_type, amount, payment_status, due_date, paid_at')
        .eq('student_id', profile.id)
        .eq('school_id', schoolId)
        .neq('payment_status', 'cancelled')
        .order('due_date', { ascending: true })

    return { error: null, student: profile, payments: payments ?? [] }
}

export async function markPaymentsPaidAction(paymentIds: string[]) {
    if (!paymentIds.length) return { error: 'Aucun paiement sélectionné' }
    const ctx = await getActionContext()
    if (!ctx) return { error: 'Non authentifié' }
    const { schoolId } = ctx
    const admin = createAdminClient()

    const now = new Date().toISOString()
    const { error } = await admin
        .from('payments')
        .update({ payment_status: 'paid', paid_at: now })
        .in('id', paymentIds)
        .eq('school_id', schoolId)

    if (error) return { error: error.message }
    return { success: true }
}
