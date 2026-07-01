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
    const { schoolId, userId } = ctx
    const admin = createAdminClient()

    // 1. Fetch details of the payments being marked as paid
    const { data: paymentsToPay, error: fetchErr } = await admin
        .from('payments')
        .select('student_id, amount, payment_type, description')
        .in('id', paymentIds)
        .eq('school_id', schoolId)

    if (fetchErr) return { error: fetchErr.message }

    const now = new Date().toISOString()
    // 2. Mark payments as paid
    const { error: updateErr } = await admin
        .from('payments')
        .update({ payment_status: 'paid', paid_at: now })
        .in('id', paymentIds)
        .eq('school_id', schoolId)

    if (updateErr) return { error: updateErr.message }

    // 3. Create transactions for each payment
    if (paymentsToPay && paymentsToPay.length > 0) {
        const transactionsToInsert = paymentsToPay.map(p => ({
            school_id: schoolId,
            type: 'tuition',
            category: p.payment_type,
            amount: p.amount,
            description: p.description || `Paiement ${p.payment_type}`,
            related_profile_id: p.student_id,
            status: 'completed',
            payment_method: 'cash',
            transaction_date: now.split('T')[0],
            created_by: userId,
        }))

        const { error: txErr } = await admin
            .from('transactions')
            .insert(transactionsToInsert)

        if (txErr) {
            console.error('Failed to insert corresponding transactions:', txErr)
        }
    }

    return { success: true }
}
