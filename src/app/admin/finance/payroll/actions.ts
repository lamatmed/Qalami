'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { logActivity } from '@/lib/activity-log'
import { markAdjustmentsIncludedAction } from '@/app/admin/teachers/actions'

export async function confirmPaymentAction(payload: {
    employeeId: string
    employeeName: string
    baseSalary: number
    bonuses: number
    deductions: number
    netSalary: number
    transactionRef: string
    notes?: string
    paymentMethod?: string
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
    const now = new Date()
    const month = now.getMonth() + 1
    const year = now.getFullYear()

    // Upsert payroll record for current month
    const { data: existing } = await admin
        .from('payroll')
        .select('id')
        .eq('school_id', me.school_id)
        .eq('employee_id', payload.employeeId)
        .eq('month', month)
        .eq('year', year)
        .maybeSingle()

    if (existing) {
        const { error } = await admin.from('payroll').update({
            base_salary: payload.baseSalary,
            bonuses: payload.bonuses,
            deductions: payload.deductions,
            net_salary: payload.netSalary,
            status: 'paid',
            paid_at: now.toISOString(),
        }).eq('id', existing.id)
        if (error) return { error: error.message }
    } else {
        const { error } = await admin.from('payroll').insert({
            school_id: me.school_id,
            employee_id: payload.employeeId,
            month,
            year,
            base_salary: payload.baseSalary,
            bonuses: payload.bonuses,
            deductions: payload.deductions,
            net_salary: payload.netSalary,
            status: 'paid',
            paid_at: now.toISOString(),
        })
        if (error) return { error: error.message }
    }

    // Upsert salary transaction — one per employee per month
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
    const monthEnd = new Date(year, month, 0).toISOString().split('T')[0]

    const { data: existingTx } = await admin
        .from('transactions')
        .select('id')
        .eq('school_id', me.school_id)
        .eq('type', 'salary')
        .eq('related_profile_id', payload.employeeId)
        .gte('transaction_date', monthStart)
        .lte('transaction_date', monthEnd)
        .maybeSingle()

    if (existingTx) {
        const { error: txErr } = await admin.from('transactions').update({
            amount: payload.netSalary,
            description: `Salaire ${month}/${year} — ${payload.employeeName}`,
            reference_number: payload.transactionRef,
            transaction_date: now.toISOString().split('T')[0],
        }).eq('id', existingTx.id)
        if (txErr) return { error: txErr.message }
    } else {
        const { error: txErr } = await admin.from('transactions').insert({
            school_id: me.school_id,
            type: 'salary',
            category: 'Salaire du personnel',
            amount: payload.netSalary,
            description: `Salaire ${month}/${year} — ${payload.employeeName}`,
            notes: payload.notes?.trim() || null,
            payment_method: payload.paymentMethod || null,
            related_profile_id: payload.employeeId,
            reference_number: payload.transactionRef,
            status: 'completed',
            transaction_date: now.toISOString().split('T')[0],
            created_by: user.id,
        })
        if (txErr) return { error: txErr.message }
    }

    // Mark all pending journal entries for this employee as included in this payroll
    await markAdjustmentsIncludedAction(payload.employeeId, existing?.id)

    logActivity({
        actorId: user.id,
        schoolId: me.school_id,
        action: 'confirm_payroll',
        entityType: 'payroll',
        entityId: payload.employeeId,
        details: `Salaire versé à ${payload.employeeName} — Net: ${payload.netSalary.toLocaleString('fr-FR')} MRU (${month}/${year}) · Réf: ${payload.transactionRef}`,
    })

    return { success: true }
}
